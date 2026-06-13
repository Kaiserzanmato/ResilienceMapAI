"use client";
import { useQuery } from "@tanstack/react-query";
import maplibregl, { Map as MLMap, Marker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef } from "react";
import { api } from "@/lib/api";
import { getMapStyle } from "@/lib/mapStyles";
import { useAppStore } from "@/lib/store";

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
    selected, setSelected,
  } = useAppStore();

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

    mapRef.current = map;
    return () => {
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
