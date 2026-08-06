"use client";
import { useQuery } from "@tanstack/react-query";
import maplibregl, { Map as MLMap, Marker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { Markdown, renderInline } from "@/components/ai/Markdown";
import { cn } from "@/lib/utils";
import { getMapStyle } from "@/lib/mapStyles";
import { useAppStore } from "@/lib/store";
import { attachHoverTelemetry, type TelemetryPayload } from "@/lib/mapHoverTelemetry";
import { getOptimizedCanvasSnapshot } from "@/lib/spatialVision";

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
  const [vision, setVision] = useState<{
    loading: boolean;
    error?: string;
    analysis?: string;
    recommendations?: string[];
  } | null>(null);
  // Guards against a stale spatial-vision response landing after the user
  // has moved to a new location or fired another request: aborted requests
  // never call setVision, so an in-flight response can't overwrite a newer
  // (or cleared) card.
  const visionAbortRef = useRef<AbortController | null>(null);
  // Mirrors telemetry/vision into refs so the hover handler (registered
  // once, on map init) can read current values without a stale closure.
  const telemetryRef = useRef<TelemetryPayload | null>(null);
  const visionRef = useRef<typeof vision>(null);
  useEffect(() => {
    telemetryRef.current = telemetry;
  }, [telemetry]);
  useEffect(() => {
    visionRef.current = vision;
  }, [vision]);

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

  // Keep latest data in refs so style reloads can re-add overlays
  const dataRef = useRef<{ zones?: GeoJSON.FeatureCollection; heat?: GeoJSON.FeatureCollection }>({});
  dataRef.current = { zones, heat };

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
    applyVisibility(map);
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

    const detachTelemetry = attachHoverTelemetry(map, (data) => {
      // The telemetry card renders at a fixed screen position, not at the
      // cursor, and the canvas stays hoverable around/under it. That means
      // moving the mouse toward the "Analyze with AI" button — or just
      // resting it over the map while a request is in flight or its result
      // is showing — fires more hover ticks for essentially the same spot.
      // Treating every tick as "a new hover" (the original behavior) killed
      // the user's own just-started or just-finished analysis with no
      // visible error, which read as the button silently not working. Only
      // actually reset when the hover has moved somewhere meaningfully
      // different (~1km) from what's currently shown.
      const prev = telemetryRef.current;
      const hasActiveAnalysis = !!(visionRef.current?.loading || visionRef.current?.analysis);
      const samePoint =
        !!prev &&
        Math.abs(prev.lat - data.lat) < 0.01 &&
        Math.abs(prev.lng - data.lng) < 0.01;

      if (hasActiveAnalysis && samePoint) {
        setTelemetry(data);
        return;
      }
      visionAbortRef.current?.abort();
      setTelemetry(data);
      setVision(null);
    });

    mapRef.current = map;
    return () => {
      visionAbortRef.current?.abort();
      detachTelemetry();
      map.remove();
      mapRef.current = null;
      styleReadyRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleAnalyzeViewport() {
    const map = mapRef.current;
    if (!map || !telemetry) return;
    // Cancel any still-in-flight request before starting a new one — a
    // double-click (or a click landing while a previous request hasn't
    // resolved) must not fire concurrent requests or let an earlier
    // response overwrite a later one.
    visionAbortRef.current?.abort();
    const controller = new AbortController();
    visionAbortRef.current = controller;

    setVision({ loading: true });
    try {
      const snapshot = getOptimizedCanvasSnapshot(map);
      const result = await api.spatialVision(
        {
          user_query: "Evaluate site safety and resilience for this viewport.",
          persona: useAppStore.getState().persona,
          map_image_base64: snapshot,
          lat: telemetry.lat,
          lng: telemetry.lng,
          deterministic_scores: { score: telemetry.score, level: telemetry.level },
          active_layers: [activeLayer],
        },
        controller.signal
      );
      if (controller.signal.aborted) return;
      setVision({
        loading: false,
        analysis: result.grounded_analysis,
        recommendations: result.actionable_recommendations,
      });
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setVision({ loading: false, error: e instanceof Error ? e.message : "Analysis failed" });
    }
  }

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zones, heat]);

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
            onClick={() => {
              visionAbortRef.current?.abort();
              setTelemetry(null);
              setVision(null);
            }}
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

          <button
            type="button"
            className="rm-telemetry-analyze"
            onClick={handleAnalyzeViewport}
            disabled={vision?.loading}
          >
            {vision?.loading ? "Analyzing…" : "Analyze with AI"}
          </button>

          {vision?.error && <div className="rm-telemetry-error">{vision.error}</div>}
          {vision?.analysis && (
            <div className="rm-telemetry-analysis">
              <Markdown text={vision.analysis} />
              {vision.recommendations && vision.recommendations.length > 0 && (
                <ul>
                  {vision.recommendations.map((rec, i) => (
                    <li key={i}>{renderInline(rec)}</li>
                  ))}
                </ul>
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
        @media (min-width: 768px) {
          /* When the AI Research Agent panel is open it pushes the risk
             summary widget left (see app/(app)/map/page.tsx: right: 760px),
             into the centered telemetry card's space. Anchor the card to
             that same 760px offset so it hugs the widget's right edge with
             a clean gap, instead of floating centered in open map space. */
          .rm-telemetry-card--ai-open {
            left: calc(100% - 760px + 16px);
            right: auto;
            transform: none;
          }
        }
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
        .rm-telemetry-analyze {
          margin-top: 8px;
          width: 100%;
          padding: 5px 8px;
          border-radius: 6px;
          border: 1px solid color-mix(in srgb, var(--accent, #38bdf8) 45%, transparent);
          background: color-mix(in srgb, var(--accent, #38bdf8) 15%, transparent);
          color: var(--fg, #fff);
          font-size: 11.5px;
          cursor: pointer;
        }
        .rm-telemetry-analyze:disabled { opacity: 0.6; cursor: default; }
        .rm-telemetry-error { margin-top: 6px; color: #f87171; }
        .rm-telemetry-analysis { margin-top: 8px; opacity: 0.9; }
        .rm-telemetry-analysis ul { margin: 4px 0 0; padding-left: 16px; }
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
