"use client";
import { useQuery } from "@tanstack/react-query";
import maplibregl, { Map as MLMap, Marker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api";
import { FLAGS } from "@/lib/feature-flags";
import { cn } from "@/lib/utils";
import { getMapStyle } from "@/lib/mapStyles";
import { useAppStore } from "@/lib/store";
import { attachHoverTelemetry, type TelemetryPayload } from "@/lib/mapHoverTelemetry";

const RISK_FILL_COLORS: [string, string][] = [
  ["green", "#22c55e"],
  ["yellow", "#eab308"],
  ["red", "#ef4444"],
];

export default function RiskMap() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const selectedMarkerRef = useRef<Marker | null>(null);
  const styleReadyRef = useRef(false);

  const {
    mapView, activeLayer, showZones, showHeatmap, showAlerts, showEvents,
    selected, setSelected, aiOpen,
  } = useAppStore();

  const [telemetry, setTelemetry] = useState<TelemetryPayload | null>(null);
  // Mirrors telemetry into a ref so the hover handler (registered once, on
  // map init) can read the current value without a stale closure.
  const telemetryRef = useRef<TelemetryPayload | null>(null);
  useEffect(() => {
    telemetryRef.current = telemetry;
  }, [telemetry]);

  const { data: zones } = useQuery({
    queryKey: ["zones", activeLayer],
    queryFn: () => api.hazardLayers(activeLayer, "geojson"),
  });
  const { data: heat } = useQuery({
    queryKey: ["heat", activeLayer],
    queryFn: () => api.hazardLayers(activeLayer, "heatmap"),
  });
  const { data: eventsData } = useQuery({
    queryKey: ["hazard-events"],
    queryFn: api.hazardEvents,
  });
  const { data: currentEvents } = useQuery({
    queryKey: ["current-events"],
    queryFn: () => api.currentEvents(),
    enabled: FLAGS.REALTIME_EVENTS,
    staleTime: 60_000,
    refetchInterval: 300_000,
    retry: 1,
  });
  const currentEventGeoJson = useMemo<GeoJSON.FeatureCollection>(() => ({
    type: "FeatureCollection",
    features: (currentEvents?.events ?? [])
      .filter((event) => event.latitude !== null && event.longitude !== null)
      .map((event) => ({
        type: "Feature" as const,
        geometry: { type: "Point" as const, coordinates: [event.longitude!, event.latitude!] },
        properties: {
          id: event.event_id,
          title: event.title,
          provider: event.provider,
          sourceTier: event.source_tier,
          severity: event.severity ?? "unknown",
          eventTime: event.event_time ?? "Unavailable",
          retrievedAt: event.retrieved_at,
          official: event.official,
          sourceUrl: event.source_url ?? "",
        },
      })),
  }), [currentEvents]);

  // Keep latest data in refs so style reloads can re-add overlays
  const dataRef = useRef<{ zones?: GeoJSON.FeatureCollection; heat?: GeoJSON.FeatureCollection; currentEvents?: GeoJSON.FeatureCollection }>({});
  dataRef.current = { zones, heat, currentEvents: currentEventGeoJson };

  function addOverlays(map: MLMap) {
    const { zones: z, heat: h } = dataRef.current;
    if (z && !map.getSource("risk-zones")) {
      map.addSource("risk-zones", { type: "geojson", data: z });
      map.addLayer({
        id: "risk-zones-fill",
        type: "fill",
        source: "risk-zones",
        paint: {
          "fill-color": [
            "match", ["get", "color"],
            ...RISK_FILL_COLORS.flat(),
            "#94a3b8",
          ] as never,
          "fill-opacity": 0.26,
        },
      });
      map.addLayer({
        id: "risk-zones-line",
        type: "line",
        source: "risk-zones",
        paint: {
          "line-color": [
            "match", ["get", "color"],
            ...RISK_FILL_COLORS.flat(),
            "#94a3b8",
          ] as never,
          "line-width": 1.6,
          "line-opacity": 0.85,
        },
      });
    }
    if (h && !map.getSource("risk-heat")) {
      map.addSource("risk-heat", { type: "geojson", data: h });
      map.addLayer({
        id: "risk-heatmap",
        type: "heatmap",
        source: "risk-heat",
        paint: {
          "heatmap-weight": ["get", "weight"] as never,
          "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 4, 0.9, 10, 2.2] as never,
          "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 4, 36, 10, 90] as never,
          "heatmap-opacity": 0.55,
          "heatmap-color": [
            "interpolate", ["linear"], ["heatmap-density"],
            0, "rgba(0,0,0,0)",
            0.25, "rgba(34,197,94,0.45)",
            0.5, "rgba(234,179,8,0.55)",
            0.75, "rgba(249,115,22,0.65)",
            1, "rgba(239,68,68,0.8)",
          ] as never,
        },
      });
    }
    addCurrentEventOverlay(map);
    applyVisibility(map);
  }

  function addCurrentEventOverlay(map: MLMap) {
    const events = dataRef.current.currentEvents;
    if (!FLAGS.REALTIME_EVENTS || !events || map.getSource("realtime-events")) return;
    map.addSource("realtime-events", {
      type: "geojson",
      data: events,
      cluster: true,
      clusterMaxZoom: 8,
      clusterRadius: 48,
    });
    map.addLayer({
      id: "realtime-event-clusters",
      type: "circle",
      source: "realtime-events",
      filter: ["has", "point_count"],
      paint: {
        "circle-color": "#d97706",
        "circle-radius": ["step", ["get", "point_count"], 15, 20, 20, 100, 26] as never,
        "circle-stroke-color": "#fff",
        "circle-stroke-width": 1.5,
      },
    });
    map.addLayer({
      id: "realtime-event-cluster-count",
      type: "symbol",
      source: "realtime-events",
      filter: ["has", "point_count"],
      layout: { "text-field": ["get", "point_count_abbreviated"] as never, "text-size": 12 },
      paint: { "text-color": "#fff" },
    });
    map.addLayer({
      id: "realtime-event-point",
      type: "circle",
      source: "realtime-events",
      filter: ["!", ["has", "point_count"]],
      paint: {
        "circle-color": ["case", ["get", "official"], "#dc2626", "#2563eb"] as never,
        "circle-radius": 7,
        "circle-stroke-color": "#fff",
        "circle-stroke-width": 1.5,
      },
    });
  }

  function applyVisibility(map: MLMap) {
    const st = useAppStore.getState();
    if (map.getLayer("risk-zones-fill")) {
      const v = st.showZones ? "visible" : "none";
      map.setLayoutProperty("risk-zones-fill", "visibility", v);
      map.setLayoutProperty("risk-zones-line", "visibility", v);
    }
    if (map.getLayer("risk-heatmap")) {
      map.setLayoutProperty("risk-heatmap", "visibility", st.showHeatmap ? "visible" : "none");
    }
  }

  // ---- init map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: getMapStyle(useAppStore.getState().mapView),
      center: [122.5, 12.5],
      zoom: 5.1,
      attributionControl: { compact: true },
      // Required so PDF exports can capture the canvas as a map snapshot
      canvasContextAttributes: { preserveDrawingBuffer: true },
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");
    map.addControl(
      new maplibregl.GeolocateControl({ positionOptions: { enableHighAccuracy: false } }),
      "bottom-right"
    );

    map.on("style.load", () => {
      styleReadyRef.current = true;
      addOverlays(map);
    });

    map.on("click", (e) => {
      const features = map.queryRenderedFeatures(e.point, { layers: ["risk-zones-fill"].filter((l) => map.getLayer(l)) });
      if (features.length > 0) {
        const p = features[0].properties as { name: string; lat: number; lng: number };
        setSelected({ lat: Number(p.lat), lng: Number(p.lng), name: p.name });
      } else {
        setSelected({ lat: e.lngLat.lat, lng: e.lngLat.lng });
      }
    });
    map.on("mouseenter", "risk-zones-fill", () => (map.getCanvas().style.cursor = "pointer"));
    map.on("mouseleave", "risk-zones-fill", () => (map.getCanvas().style.cursor = ""));
    map.on("click", "realtime-event-clusters", (event) => {
      const feature = event.features?.[0];
      const clusterId = feature?.properties?.cluster_id;
      const source = map.getSource("realtime-events") as maplibregl.GeoJSONSource | undefined;
      const geometry = feature?.geometry;
      if (typeof clusterId === "number" && source && geometry?.type === "Point") {
        const center = geometry.coordinates as [number, number];
        source.getClusterExpansionZoom(clusterId).then((zoom) => map.easeTo({ center, zoom }));
      }
    });
    map.on("click", "realtime-event-point", (event) => {
      const feature = event.features?.[0];
      if (!feature || feature.geometry.type !== "Point") return;
      const properties = feature.properties ?? {};
      const content = document.createElement("div");
      const heading = document.createElement("strong");
      heading.textContent = String(properties.title ?? "Current event");
      const details = document.createElement("div");
      details.style.cssText = "font-size:11.5px;opacity:.75;margin-top:4px";
      details.textContent = `${properties.official ? "Official" : "Supplemental"} Tier ${properties.sourceTier} | ${properties.provider} | ${properties.severity}`;
      const timing = document.createElement("div");
      timing.style.cssText = "font-size:10.5px;opacity:.6;margin-top:3px";
      timing.textContent = `Event: ${properties.eventTime} | Retrieved: ${properties.retrievedAt}`;
      content.append(heading, details, timing);
      new maplibregl.Popup({ offset: 10, closeButton: true }).setDOMContent(content).setLngLat((feature.geometry.coordinates as [number, number])).addTo(map);
    });

    const detachTelemetry = attachHoverTelemetry(map, (data) => {
      setTelemetry(data);
    });

    mapRef.current = map;
    return () => {
      detachTelemetry();
      map.remove();
      mapRef.current = null;
      styleReadyRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- switch base style (smooth: overlays re-added on style.load)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    styleReadyRef.current = false;
    map.setStyle(getMapStyle(mapView), { diff: false });
  }, [mapView]);

  // ---- update overlay data when the active hazard layer changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleReadyRef.current) return;
    if (zones) {
      const src = map.getSource("risk-zones") as maplibregl.GeoJSONSource | undefined;
      if (src) src.setData(zones);
      else addOverlays(map);
    }
    if (heat) {
      const src = map.getSource("risk-heat") as maplibregl.GeoJSONSource | undefined;
      if (src) src.setData(heat);
      else addOverlays(map);
    }
    if (FLAGS.REALTIME_EVENTS) {
      const src = map.getSource("realtime-events") as maplibregl.GeoJSONSource | undefined;
      if (src) src.setData(currentEventGeoJson);
      else addCurrentEventOverlay(map);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zones, heat, currentEventGeoJson]);

  // ---- toggle layer visibility
  useEffect(() => {
    const map = mapRef.current;
    if (map && styleReadyRef.current) applyVisibility(map);
  }, [showZones, showHeatmap]);

  // ---- alert + event DOM markers (survive style switches automatically)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !eventsData) return;
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    if (showAlerts) {
      for (const alert of eventsData.alerts) {
        const el = document.createElement("button");
        el.className = "rm-alert-marker";
        el.setAttribute("aria-label", `Active alert: ${alert.title}`);
        el.innerHTML = `<span class="rm-pulse"></span><span class="rm-dot"></span>`;
        const popup = new maplibregl.Popup({ offset: 14, closeButton: false }).setHTML(
          `<strong style="font-size:13px">${alert.title}</strong>
           <div style="font-size:11.5px;opacity:.75;margin-top:2px">${alert.area} · ${alert.severity} severity</div>
           <div style="font-size:10.5px;opacity:.6;margin-top:2px">Source: ${alert.source}</div>`
        );
        markersRef.current.push(
          new maplibregl.Marker({ element: el }).setLngLat([alert.lng, alert.lat]).setPopup(popup).addTo(map)
        );
      }
    }
    if (showEvents) {
      for (const ev of eventsData.events) {
        const el = document.createElement("button");
        el.className = "rm-event-marker";
        el.setAttribute("aria-label", `Historical event: ${ev.name}`);
        const popup = new maplibregl.Popup({ offset: 10, closeButton: false }).setHTML(
          `<strong style="font-size:13px">${ev.name}</strong>
           <div style="font-size:11.5px;opacity:.75;margin-top:2px">${ev.year} · ${ev.location}</div>
           <div style="font-size:10.5px;opacity:.6;margin-top:2px">${ev.severity} · Source: ${ev.source}</div>`
        );
        markersRef.current.push(
          new maplibregl.Marker({ element: el }).setLngLat([ev.lng, ev.lat]).setPopup(popup).addTo(map)
        );
      }
    }
  }, [eventsData, showAlerts, showEvents]);

  // ---- selected location: marker + animated zoom
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    selectedMarkerRef.current?.remove();
    selectedMarkerRef.current = null;
    if (selected) {
      const el = document.createElement("div");
      el.className = "rm-selected-marker";
      el.innerHTML = `<span></span>`;
      selectedMarkerRef.current = new maplibregl.Marker({ element: el })
        .setLngLat([selected.lng, selected.lat])
        .addTo(map);
      map.flyTo({
        center: [selected.lng, selected.lat],
        zoom: Math.max(map.getZoom(), 8.5),
        duration: 1600,
        essential: true,
      });
    }
  }, [selected]);

  return (
    <>
      {/* Inline position/inset: maplibregl-map's own CSS overrides Tailwind's class */}
      <div
        ref={containerRef}
        style={{ position: "absolute", inset: 0 }}
        role="application"
        aria-label="Risk intelligence map"
      />

      {telemetry && (
        <div
          className={cn("rm-telemetry-card", aiOpen && "rm-telemetry-card--ai-open")}
          role="status"
          aria-live="polite"
        >
          <button
            type="button"
            className="rm-telemetry-dismiss"
            aria-label="Dismiss hover telemetry"
            onClick={() => setTelemetry(null)}
          >
            ×
          </button>
          <div className="rm-telemetry-coords">
            {telemetry.lat.toFixed(4)}, {telemetry.lng.toFixed(4)}
          </div>
          {telemetry.name && (
            <div className="rm-telemetry-zone">
              <strong>{telemetry.name}</strong>
              {telemetry.country ? ` · ${telemetry.country}` : ""}
              {typeof telemetry.score === "number" && (
                <div className="rm-telemetry-score">
                  {telemetry.hazard ?? "Overall"} risk: {Math.round(telemetry.score)}/100
                  {telemetry.level ? ` (${telemetry.level})` : ""}
                </div>
              )}
              {typeof telemetry.population === "number" && (
                <div className="rm-telemetry-pop">
                  Population: {telemetry.population.toLocaleString()}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <style jsx global>{`
        .rm-telemetry-card {
          position: absolute;
          left: 50%;
          top: calc(var(--banner-h, 0px) + var(--nav-h, 0px) + 92px);
          transform: translateX(-50%);
          z-index: 25;
          max-width: 260px;
          max-height: calc(100vh - var(--banner-h, 0px) - var(--nav-h, 0px) - 140px);
          overflow-y: auto;
          padding: 10px 28px 10px 12px;
          border-radius: 10px;
          background: color-mix(in srgb, var(--bg, #0b1220) 82%, transparent);
          border: 1px solid color-mix(in srgb, var(--fg, #fff) 12%, transparent);
          backdrop-filter: blur(8px);
          font-size: 12px;
          line-height: 1.4;
          color: var(--fg, #fff);
          pointer-events: auto;
        }
        /* The summary and panel own the top overlay region while AI is open.
           Telemetry remains available whenever AI is closed, without a
           viewport-dependent offset that could clip it. */
        .rm-telemetry-card--ai-open { display: none; }
        .rm-telemetry-dismiss {
          position: absolute;
          top: 4px;
          right: 6px;
          width: 20px;
          height: 20px;
          border: none;
          background: none;
          color: var(--fg-muted, #94a3b8);
          font-size: 15px;
          line-height: 1;
          cursor: pointer;
        }
        .rm-telemetry-dismiss:hover { color: var(--fg, #fff); }
        .rm-telemetry-coords { opacity: 0.65; font-variant-numeric: tabular-nums; }
        .rm-telemetry-zone { margin-top: 4px; }
        .rm-telemetry-score { margin-top: 2px; opacity: 0.85; }
        .rm-telemetry-pop { opacity: 0.65; }
      `}</style>
      <style jsx global>{`
        .rm-alert-marker { position: relative; width: 26px; height: 26px; background: none; border: none; cursor: pointer; }
        .rm-alert-marker .rm-dot { position: absolute; inset: 7px; border-radius: 999px; background: #f97316; box-shadow: 0 0 10px #f97316; }
        .rm-alert-marker .rm-pulse { position: absolute; inset: 0; border-radius: 999px; background: rgba(249, 115, 22, 0.4); animation: rm-pulse 1.8s ease-out infinite; }
        @keyframes rm-pulse { 0% { transform: scale(0.5); opacity: 0.9; } 100% { transform: scale(1.5); opacity: 0; } }
        .rm-event-marker { width: 14px; height: 14px; border-radius: 999px; border: 2px solid #fff; background: var(--accent-2, #a78bfa); cursor: pointer; box-shadow: 0 1px 6px rgba(0,0,0,0.4); }
        .rm-selected-marker { width: 22px; height: 22px; }
        .rm-selected-marker span { display: block; width: 100%; height: 100%; border-radius: 999px; border: 3px solid #fff; background: var(--accent, #38bdf8); box-shadow: 0 0 0 4px color-mix(in srgb, var(--accent, #38bdf8) 35%, transparent), 0 2px 10px rgba(0,0,0,0.45); }
        @media (prefers-reduced-motion: reduce) { .rm-alert-marker .rm-pulse { animation: none; } }
      `}</style>
    </>
  );
}
