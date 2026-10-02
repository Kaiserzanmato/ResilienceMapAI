"use client";
import { pointToCountry } from "@/lib/locations/point-to-country";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import "@/lib/maplibre-worker";
import * as maplibregl from "maplibre-gl";
import { Map as MLMap, Marker, type StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api";
import { FLAGS } from "@/lib/feature-flags";
import {
  aoiCollection, describeFloodArea, FLOOD_SOURCE_LABEL, markerCollection, viewportBboxParam, type FloodFeature,
} from "@/lib/flood-evidence";
import { cn } from "@/lib/utils";
import { getMapStyle } from "@/lib/mapStyles";
import { useAppStore, type MapProjection } from "@/lib/store";
import { revealPopup, safeArea } from "@/lib/map-layout";
import { attachHoverTelemetry, type TelemetryPayload } from "@/lib/mapHoverTelemetry";
import { getNearestEvacuationCenters } from "@/lib/evacuation-centers";
import { EvacuationCard } from "./EvacuationCard";
import { SpatialRippleEffect } from "./SpatialRippleEffect";

const RISK_FILL_COLORS: [string, string][] = [
  ["green", "#22c55e"],
  ["yellow", "#eab308"],
  ["red", "#ef4444"],
];

function styleWithProjection(view: string, projection: MapProjection): StyleSpecification {
  return { ...getMapStyle(view), projection: { type: projection } };
}

/** Builds popup content via textContent (never innerHTML/setHTML) so
 * externally-sourced fields (alert/event titles, e.g. from scraped
 * advisories) can never inject markup, independent of maplibre-gl's own
 * DOM sanitizer. */
function buildPopupContent(title: string, lines: string[]): HTMLDivElement {
  const content = document.createElement("div");
  const heading = document.createElement("strong");
  heading.style.cssText = "font-size:13px";
  heading.textContent = title;
  content.append(heading);
  lines.forEach((line, i) => {
    const div = document.createElement("div");
    div.style.cssText = i === 0
      ? "font-size:11.5px;opacity:.75;margin-top:2px"
      : "font-size:10.5px;opacity:.6;margin-top:2px";
    div.textContent = line;
    content.append(div);
  });
  return content;
}

const RISK_LEVEL_TO_SEVERITY: Record<string, "low" | "medium" | "high"> = {
  "High": "high",
  "Medium": "medium",
  "Low": "low",
  "No Data": "low",
};

// Drawn bottom to top; raised above every other overlay (see raiseFloodLayers).
const FLOOD_LAYER_IDS = ["flood-extents-fill", "flood-extents-line", "flood-aoi-line", "flood-capture-marker", "flood-flags-circle"];

const EMPTY_COLLECTION: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

export default function RiskMap() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const selectedMarkerRef = useRef<Marker | null>(null);
  const evacMarkersRef = useRef<Marker[]>([]);
  const styleReadyRef = useRef(false);

  const {
    mapView, mapProjection, activeLayer, showZones, showHeatmap, showAlerts, showEvents,
    selected, setSelected, aiOpen, lastAssessmentCoords, risk,
    showEvacuationCenters, selectedEvacuationCenter, setSelectedEvacuationCenter, showFloodExtents, floodFocus,
  } = useAppStore();

  const [evacCardPos, setEvacCardPos] = useState<{ x: number; top: number; maxHeight: number } | null>(null);

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
  // The extents shown follow the map view (padded and rounded, so small pans reuse the
  // cached query); a view wider than the API accepts falls back to the capped global list.
  const [floodBbox, setFloodBbox] = useState<string | null>(null);
  const { data: floodExtents } = useQuery({
    queryKey: ["flood-extents", floodBbox],
    queryFn: () => api.floodExtents(floodBbox ?? undefined),
    enabled: FLAGS.FLOOD_CAPTURE,
    placeholderData: keepPreviousData, // keep drawing the old view's extents while the next loads
    staleTime: 60_000,
    refetchInterval: 300_000,
    retry: 1,
  });
  const { data: floodFlags } = useQuery({
    queryKey: ["flood-flags"],
    queryFn: api.floodFlags,
    enabled: FLAGS.FLOOD_CAPTURE,
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

  const floodAoi = useMemo(() => aoiCollection(floodExtents?.features as unknown as FloodFeature[] | undefined), [floodExtents]);
  const floodMarkers = useMemo(() => markerCollection(floodExtents?.features as unknown as FloodFeature[] | undefined), [floodExtents]);

  // Keep latest data in refs so style reloads can re-add overlays
  const dataRef = useRef<{
    zones?: GeoJSON.FeatureCollection;
    heat?: GeoJSON.FeatureCollection;
    currentEvents?: GeoJSON.FeatureCollection;
    floodExtents?: GeoJSON.FeatureCollection;
    floodFlags?: GeoJSON.FeatureCollection;
    floodAoi?: GeoJSON.FeatureCollection;
    floodMarkers?: GeoJSON.FeatureCollection;
  }>({});
  dataRef.current = { zones, heat, currentEvents: currentEventGeoJson, floodExtents, floodFlags, floodAoi, floodMarkers };

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
    addFloodOverlay(map);
    addCurrentEventOverlay(map);
    applyVisibility(map);
  }

  // Satellite-derived water (blue polygons), the capture box (dashed outline), a marker at
  // the capture's centre for low zoom, and user flood flags (orange dots).
  //
  // A 5 km capture of small ponds is only a few pixels wide at overview zooms, which made
  // captures look like they had not rendered. The dashed box and the marker are what you see
  // when zoomed out; the water polygons take over as you zoom in (and "zoom to capture" fits
  // the map to the box). The sources are created empty, so they exist for style reloads and
  // fill in via setData once the queries resolve.
  function addFloodOverlay(map: MLMap) {
    if (!FLAGS.FLOOD_CAPTURE) return;
    if (!map.getSource("flood-extents")) {
      map.addSource("flood-extents", { type: "geojson", data: dataRef.current.floodExtents ?? EMPTY_COLLECTION });
      map.addSource("flood-aoi", { type: "geojson", data: dataRef.current.floodAoi ?? EMPTY_COLLECTION });
      map.addSource("flood-markers", { type: "geojson", data: dataRef.current.floodMarkers ?? EMPTY_COLLECTION });
      map.addSource("flood-flags", { type: "geojson", data: dataRef.current.floodFlags ?? EMPTY_COLLECTION });
      map.addLayer({
        id: "flood-extents-fill",
        type: "fill",
        source: "flood-extents",
        paint: { "fill-color": "#0ea5e9", "fill-opacity": 0.6 },
      });
      map.addLayer({
        id: "flood-extents-line",
        type: "line",
        source: "flood-extents",
        paint: {
          "line-color": "#e0f2fe",
          "line-width": ["interpolate", ["linear"], ["zoom"], 8, 0.4, 13, 1.4] as never,
          "line-opacity": 0.95,
        },
      });
      map.addLayer({
        id: "flood-aoi-line",
        type: "line",
        source: "flood-aoi",
        paint: { "line-color": "#38bdf8", "line-width": 1.6, "line-dasharray": [3, 2] },
      });
      map.addLayer({
        id: "flood-capture-marker",
        type: "circle",
        source: "flood-markers",
        maxzoom: 11,
        paint: {
          "circle-color": "#0ea5e9",
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 3, 5, 10, 11] as never,
          "circle-stroke-color": "#fff",
          "circle-stroke-width": 2,
        },
      });
      map.addLayer({
        id: "flood-flags-circle",
        type: "circle",
        source: "flood-flags",
        paint: {
          "circle-color": "#f97316",
          "circle-radius": 6,
          "circle-stroke-color": "#fff",
          "circle-stroke-width": 1.5,
        },
      });
    }
    raiseFloodLayers(map);
  }

  /** Keep the flood layers above the risk zones, heatmap and event layers, whatever order
   * those were added in (the zones are added later, once their query resolves). */
  function raiseFloodLayers(map: MLMap) {
    for (const id of FLOOD_LAYER_IDS) if (map.getLayer(id)) map.moveLayer(id);
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
    for (const id of FLOOD_LAYER_IDS) {
      if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", st.showFloodExtents ? "visible" : "none");
    }
  }

  // ---- init map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: styleWithProjection(useAppStore.getState().mapView, useAppStore.getState().mapProjection),
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
      // A projection toggle made while this style was loading was skipped; apply it now
      const wanted = useAppStore.getState().mapProjection;
      if (map.getProjection()?.type !== wanted) map.setProjection({ type: wanted });
      styleReadyRef.current = true;
      addOverlays(map);
    });

    let clickSeq = 0;
    map.on("click", async (e) => {
      const seq = ++clickSeq;
      const features = map.queryRenderedFeatures(e.point, { layers: ["risk-zones-fill"].filter((l) => map.getLayer(l)) });
      // Keep the exact clicked coordinates: snapping to a zone centre made
      // neighbouring places (e.g. Bulacan) assess as "Metro Manila". The zone
      // name is only added as context.
      const zoneName = features.length > 0 ? (features[0].properties as { name?: string }).name : undefined;
      const { lat, lng } = e.lngLat;
      const countryCode = await pointToCountry(lat, lng);
      if (seq !== clickSeq) return; // a newer click superseded this one
      setSelected({ lat, lng, ...(zoneName ? { name: zoneName } : {}), ...(countryCode ? { countryCode } : {}) });
    });
    map.on("mouseenter", "risk-zones-fill", () => (map.getCanvas().style.cursor = "pointer"));
    map.on("mouseleave", "risk-zones-fill", () => (map.getCanvas().style.cursor = ""));
    const showCapturePopup = (props: Record<string, unknown> | null | undefined, lngLat: maplibregl.LngLatLike) => {
      if (!props) return;
      const area = describeFloodArea({
        water_area_m2: Number(props.water_area_m2 ?? 0),
        total_water_ha: props.total_water_ha == null ? undefined : Number(props.total_water_ha),
        flood_ha: props.flood_ha == null ? null : Number(props.flood_ha),
      });
      const scene = String(props.acquired_at ?? "").slice(0, 10) || "unknown date";
      const content = buildPopupContent("Satellite-detected surface water", [
        `${FLOOD_SOURCE_LABEL[String(props.source)] ?? "Satellite"} · scene of ${scene}`,
        `In the captured box: ${area.text}`,
        area.filtered
          ? "Automated estimate; permanent water removed (JRC Global Surface Water). Not an official flood map."
          : `${area.unfilteredNote} Automated estimate; not an official flood map.`,
      ]);
      revealPopup(map, new maplibregl.Popup({ offset: 10, closeButton: true }).setDOMContent(content).setLngLat(lngLat).addTo(map));
    };
    for (const layer of ["flood-extents-fill", "flood-capture-marker"]) {
      map.on("mouseenter", layer, () => (map.getCanvas().style.cursor = "pointer"));
      map.on("mouseleave", layer, () => (map.getCanvas().style.cursor = ""));
      map.on("click", layer, (event) => showCapturePopup(event.features?.[0]?.properties, event.lngLat));
    }
    map.on("click", "flood-flags-circle", (event) => {
      const feature = event.features?.[0];
      if (!feature || feature.geometry.type !== "Point") return;
      const reported = String(feature.properties?.created_at ?? "").slice(0, 10) || "recently";
      const content = buildPopupContent("Flooding reported here", [`Flagged by a user on ${reported}`, "Unverified report"]);
      revealPopup(map, new maplibregl.Popup({ offset: 10, closeButton: true })
        .setDOMContent(content)
        .setLngLat(feature.geometry.coordinates as [number, number])
        .addTo(map));
    });
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
      revealPopup(map, new maplibregl.Popup({ offset: 10, closeButton: true }).setDOMContent(content).setLngLat((feature.geometry.coordinates as [number, number])).addTo(map));
    });

    const detachTelemetry = attachHoverTelemetry(map, (data) => {
      setTelemetry(data);
    });

    // Follow the view for the flood extents query (debounced so a pan or zoom is one request).
    let floodBboxTimer: ReturnType<typeof setTimeout> | undefined;
    const updateFloodBbox = () => {
      clearTimeout(floodBboxTimer);
      floodBboxTimer = setTimeout(() => {
        const b = map.getBounds();
        setFloodBbox(viewportBboxParam([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]));
      }, 400);
    };
    if (FLAGS.FLOOD_CAPTURE) {
      map.on("moveend", updateFloodBbox);
      updateFloodBbox();
    }

    mapRef.current = map;
    return () => {
      detachTelemetry();
      clearTimeout(floodBboxTimer);
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
    // Projection lives in the style spec so a basemap switch keeps the globe
    map.setStyle(styleWithProjection(mapView, useAppStore.getState().mapProjection), { diff: false });
  }, [mapView]);

  // ---- switch 2D map / 3D globe (same map instance, so overlays and selection carry over)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleReadyRef.current) return;
    map.setProjection({ type: mapProjection });
  }, [mapProjection]);

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
    if (FLAGS.FLOOD_CAPTURE) {
      const extents = map.getSource("flood-extents") as maplibregl.GeoJSONSource | undefined;
      if (extents) extents.setData(floodExtents ?? EMPTY_COLLECTION);
      const flags = map.getSource("flood-flags") as maplibregl.GeoJSONSource | undefined;
      if (flags) flags.setData(floodFlags ?? EMPTY_COLLECTION);
      (map.getSource("flood-aoi") as maplibregl.GeoJSONSource | undefined)?.setData(floodAoi);
      (map.getSource("flood-markers") as maplibregl.GeoJSONSource | undefined)?.setData(floodMarkers);
      if (!extents) addFloodOverlay(map);
      else raiseFloodLayers(map);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zones, heat, currentEventGeoJson, floodExtents, floodFlags, floodAoi, floodMarkers]);

  // ---- fit the map to a capture (after a flag completes, or "Zoom to capture")
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !floodFocus) return;
    const [west, south, east, north] = floodFocus.bbox;
    // Leave room for the layer panel (left) and the risk panel (right) on wide screens.
    const wide = map.getContainer().clientWidth >= 1200;
    map.fitBounds([[west, south], [east, north]], {
      padding: { top: 120, bottom: 70, left: wide ? 300 : 40, right: wide ? 420 : 40 },
      maxZoom: 13,
      duration: 1400,
      essential: true,
    });
  }, [floodFocus]);

  // ---- toggle layer visibility
  useEffect(() => {
    const map = mapRef.current;
    if (map && styleReadyRef.current) applyVisibility(map);
  }, [showZones, showHeatmap, showFloodExtents]);

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
        const popup = new maplibregl.Popup({ offset: 14, closeButton: false }).setDOMContent(
          buildPopupContent(alert.title, [`${alert.area} · ${alert.severity} severity`, `Source: ${alert.source}`])
        );
        popup.on("open", () => revealPopup(map, popup));
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
        const popup = new maplibregl.Popup({ offset: 10, closeButton: false }).setDOMContent(
          buildPopupContent(ev.name, [`${ev.year} · ${ev.location}`, `${ev.severity} · Source: ${ev.source}`])
        );
        popup.on("open", () => revealPopup(map, popup));
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

  // ---- evacuation center markers: locate nearest, fly to closest, show card
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    evacMarkersRef.current.forEach((m) => m.remove());
    evacMarkersRef.current = [];

    if (!showEvacuationCenters) {
      setSelectedEvacuationCenter(null);
      return;
    }

    const center = map.getCenter();
    const targetLat = selected?.lat ?? center.lat;
    const targetLng = selected?.lng ?? center.lng;
    const nearest = getNearestEvacuationCenters(targetLat, targetLng, 5);
    if (nearest.length === 0) return;

    for (const site of nearest) {
      const el = document.createElement("button");
      el.className = "rm-evac-marker";
      el.setAttribute("aria-label", `Evacuation center: ${site.name}`);
      el.innerHTML = `<span>🛡️</span>`;
      el.onclick = () => setSelectedEvacuationCenter(site);
      evacMarkersRef.current.push(
        new maplibregl.Marker({ element: el }).setLngLat([site.lng, site.lat]).addTo(map)
      );
    }

    const closest = nearest[0];
    map.flyTo({ center: [closest.lng, closest.lat], zoom: 14, duration: 1600, essential: true });
    setSelectedEvacuationCenter(closest);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showEvacuationCenters, selected]);

  // ---- keep the evacuation card anchored over its marker as the map moves.
  // The free area comes from the floating controls themselves (data-map-obstruction, see
  // lib/map-layout.ts): the card picks the side of the marker with room and is clamped inside
  // that area, so it can never open under the search bar, the Run AI Risk Assessment button,
  // the risk summary or the footer. Its height is capped to the free area and scrolls inside.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedEvacuationCenter) {
      setEvacCardPos(null);
      return;
    }
    const CARD_HEIGHT_ESTIMATE = 340;
    const MARKER_GAP = 18;
    const update = () => {
      const point = map.project([selectedEvacuationCenter.lng, selectedEvacuationCenter.lat]);
      const area = safeArea(map.getContainer());
      const cardWidth = Math.min(288, area.right - area.left);
      const available = area.bottom - area.top;
      const cardHeight = Math.min(CARD_HEIGHT_ESTIMATE, available);

      const spaceAbove = point.y - MARKER_GAP - area.top;
      const spaceBelow = area.bottom - (point.y + MARKER_GAP);
      const anchorAbove = spaceAbove >= cardHeight || spaceAbove >= spaceBelow;

      let top = anchorAbove ? point.y - MARKER_GAP - cardHeight : point.y + MARKER_GAP;
      top = Math.min(Math.max(top, area.top), area.bottom - cardHeight);

      const half = cardWidth / 2;
      const x = Math.min(Math.max(point.x, area.left + half), area.right - half);
      setEvacCardPos({ x, top, maxHeight: available });
    };
    update();
    map.on("move", update);
    window.addEventListener("resize", update);
    return () => {
      map.off("move", update);
      window.removeEventListener("resize", update);
    };
  }, [selectedEvacuationCenter]);

  return (
    <>
      {/* Inline position/inset: maplibregl-map's own CSS overrides Tailwind's class */}
      <div
        ref={containerRef}
        style={{ position: "absolute", inset: 0 }}
        role="application"
        aria-label="Risk intelligence map"
      />

      {/* Spatial ripple effect when assessment completes */}
      {lastAssessmentCoords && (
        <SpatialRippleEffect
          map={mapRef.current}
          lat={lastAssessmentCoords[0]}
          lng={lastAssessmentCoords[1]}
          severity={RISK_LEVEL_TO_SEVERITY[risk?.overall.level ?? "No Data"]}
        />
      )}

      {selectedEvacuationCenter && evacCardPos && (
        <EvacuationCard
          center={selectedEvacuationCenter}
          onClose={() => setSelectedEvacuationCenter(null)}
          style={{
            position: "absolute",
            left: evacCardPos.x,
            top: evacCardPos.top,
            transform: "translateX(-50%)",
            maxWidth: "calc(100% - 24px)",
            maxHeight: evacCardPos.maxHeight,
            overflowY: "auto",
            zIndex: "var(--z-popups)",
          }}
        />
      )}

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
              <span className="rm-telemetry-sample-tag">Sample map zone</span>
              <div>
                <strong>{telemetry.name}</strong>
                {telemetry.country ? ` · ${telemetry.country}` : ""}
              </div>
              {/* This readout comes from the built-in sample zones (major cities) that colour
                  the map. It is illustrative only. It deliberately shows no 0-100 score: the
                  panel's per-location assessment is the only place a score appears, and only
                  where a real source backs it, so the two can never disagree. */}
              {typeof telemetry.level === "string" && (
                <div className="rm-telemetry-score">
                  {telemetry.hazard && telemetry.hazard !== "overall" ? `${telemetry.hazard} zone shading: ` : "Zone shading: "}
                  {telemetry.level.toLowerCase()} (illustrative)
                </div>
              )}
              <div className="rm-telemetry-illustrative">
                Sample overlay, not an assessment. See the risk panel for verified data.
              </div>
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
          z-index: var(--z-popups);
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
        .rm-telemetry-illustrative { margin-top: 2px; opacity: 0.55; font-size: 10.5px; font-style: italic; }
        .rm-telemetry-sample-tag {
          display: inline-block; margin-bottom: 2px; padding: 0 6px; border-radius: 999px;
          border: 1px solid currentColor; opacity: 0.7; font-size: 9.5px; letter-spacing: 0.04em; text-transform: uppercase;
        }
      `}</style>
      <style jsx global>{`
        .rm-alert-marker { position: relative; width: 26px; height: 26px; background: none; border: none; cursor: pointer; }
        .rm-alert-marker .rm-dot { position: absolute; inset: 7px; border-radius: 999px; background: #f97316; box-shadow: 0 0 10px #f97316; }
        .rm-alert-marker .rm-pulse { position: absolute; inset: 0; border-radius: 999px; background: rgba(249, 115, 22, 0.4); animation: rm-pulse 1.8s ease-out infinite; }
        @keyframes rm-pulse { 0% { transform: scale(0.5); opacity: 0.9; } 100% { transform: scale(1.5); opacity: 0; } }
        .rm-event-marker { width: 14px; height: 14px; border-radius: 999px; border: 2px solid #fff; background: var(--accent-2, #a78bfa); cursor: pointer; box-shadow: 0 1px 6px rgba(0,0,0,0.4); }
        .rm-selected-marker { width: 22px; height: 22px; }
        .rm-selected-marker span { display: block; width: 100%; height: 100%; border-radius: 999px; border: 3px solid #fff; background: var(--accent, #38bdf8); box-shadow: 0 0 0 4px color-mix(in srgb, var(--accent, #38bdf8) 35%, transparent), 0 2px 10px rgba(0,0,0,0.45); }
        .rm-evac-marker { width: 28px; height: 28px; border-radius: 999px; border: 2px solid #fff; background: #10b981; box-shadow: 0 2px 8px rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; font-size: 13px; line-height: 1; cursor: pointer; padding: 0; }
        @media (prefers-reduced-motion: reduce) { .rm-alert-marker .rm-pulse { animation: none; } }
      `}</style>
    </>
  );
}
