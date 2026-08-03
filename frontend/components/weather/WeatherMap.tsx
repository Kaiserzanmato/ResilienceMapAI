"use client";
import maplibregl, { Map as MLMap, Popup } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef } from "react";
import { getMapStyle } from "@/lib/mapStyles";
import type { WeatherLayerKey } from "@/lib/weatherLayers";

const WEATHER_SOURCE_ID = "owm-weather";
const WEATHER_LAYER_ID = "owm-weather-layer";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

interface CurrentWeather {
  name?: string;
  main?: { temp: number; feels_like: number; humidity: number };
  weather?: { description: string }[];
  wind?: { speed: number };
}

export default function WeatherMap({ layer }: { layer: WeatherLayerKey }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const popupRef = useRef<Popup | null>(null);
  // True once the map's one-time "load" event has fired. isStyleLoaded()
  // looks like the right gate for "safe to addSource/addLayer", but it
  // actually reports false whenever ANY tile is mid-fetch — which is true
  // almost constantly during normal panning, long after the map is ready.
  // Gating every layer switch on it routed most switches through
  // map.once("load", ...) — but "load" only ever fires once, at map
  // creation, so those switches silently never ran again.
  const mapReadyRef = useRef(false);

  // ---- init map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: getMapStyle("dark"),
      center: [122.5, 12.5],
      zoom: 4.2,
      attributionControl: { compact: true },
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");
    map.once("load", () => {
      mapReadyRef.current = true;
    });

    map.on("click", async (e) => {
      const { lat, lng } = e.lngLat;
      popupRef.current?.remove();
      popupRef.current = new maplibregl.Popup({ closeButton: true, offset: 12 })
        .setLngLat([lng, lat])
        .setHTML(`<div style="font-size:12.5px">Loading conditions…</div>`)
        .addTo(map);

      try {
        const res = await fetch(`/api/weather-current?lat=${lat}&lon=${lng}`);
        const data: CurrentWeather = await res.json();
        if (!res.ok || !data.main) {
          popupRef.current?.setHTML(
            `<div style="font-size:12.5px">Live conditions unavailable here.</div>`
          );
          return;
        }
        const desc = escapeHtml(data.weather?.[0]?.description ?? "—");
        const name = escapeHtml(data.name || "Selected point");
        popupRef.current?.setHTML(`
          <div style="font-size:13px;min-width:140px">
            <strong>${name}</strong>
            <div style="margin-top:4px;font-size:20px;font-weight:600">${Math.round(data.main.temp)}°C</div>
            <div style="opacity:.75;text-transform:capitalize">${desc}</div>
            <div style="opacity:.6;font-size:11px;margin-top:4px">
              Feels ${Math.round(data.main.feels_like)}°C · Humidity ${data.main.humidity}% · Wind ${data.wind?.speed ?? "—"} m/s
            </div>
          </div>
        `);
      } catch {
        popupRef.current?.setHTML(
          `<div style="font-size:12.5px">Live conditions unavailable here.</div>`
        );
      }
    });

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // ---- swap the weather tile overlay whenever the selected layer changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const applyLayer = () => {
      if (map.getLayer(WEATHER_LAYER_ID)) map.removeLayer(WEATHER_LAYER_ID);
      if (map.getSource(WEATHER_SOURCE_ID)) map.removeSource(WEATHER_SOURCE_ID);
      map.addSource(WEATHER_SOURCE_ID, {
        type: "raster",
        tiles: [`${window.location.origin}/api/weather-tiles/${layer}/{z}/{x}/{y}`],
        tileSize: 256,
        attribution: "Weather © OpenWeatherMap",
      });
      map.addLayer({
        id: WEATHER_LAYER_ID,
        type: "raster",
        source: WEATHER_SOURCE_ID,
        paint: {
          // Near-opaque, not 0.75 — a lower opacity blends the tile's own
          // colors with the base map underneath and reads as washed out.
          "raster-opacity": 0.92,
          // OWM's free-tier tiles are inherently pale/low-contrast for
          // typical (non-extreme) readings — boosting saturation/contrast
          // here makes that same data read clearly instead of looking dull.
          "raster-saturation": 0.6,
          "raster-contrast": 0.3,
        },
      });
    };

    // Only the very first call (immediately on mount, before the map's
    // one-time "load" event) needs to wait; every layer switch after that
    // can call applyLayer() directly.
    if (mapReadyRef.current) {
      applyLayer();
    } else {
      map.once("load", applyLayer);
    }
  }, [layer]);

  return (
    <div
      ref={containerRef}
      style={{ position: "absolute", inset: 0 }}
      role="application"
      aria-label="Weather forecast map"
    />
  );
}
