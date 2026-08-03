"use client";
import maplibregl, { Map as MLMap, Popup } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef } from "react";
import type { WeatherLayerKey } from "@/lib/weatherLayers";

const BASE_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    "carto-dark": {
      type: "raster",
      tiles: [
        "https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
        "https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
        "https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
      ],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors © CARTO",
    },
  },
  layers: [{ id: "carto-dark-layer", type: "raster", source: "carto-dark" }],
};

const WEATHER_SOURCE_ID = "owm-weather";
const WEATHER_LAYER_ID = "owm-weather-layer";

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
  const pendingLayerApplyRef = useRef<(() => void) | null>(null);

  // ---- init map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: BASE_STYLE,
      center: [122.5, 12.5],
      zoom: 4.2,
      attributionControl: { compact: true },
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");

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
        const desc = data.weather?.[0]?.description ?? "—";
        popupRef.current?.setHTML(`
          <div style="font-size:13px;min-width:140px">
            <strong>${data.name || "Selected point"}</strong>
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
        paint: { "raster-opacity": 0.75 },
      });
    };

    // If the base style is still loading, only the most recently selected
    // layer should ever get applied — cancel any earlier pending listener
    // instead of letting them all fire in sequence once "load" happens.
    if (map.isStyleLoaded()) {
      applyLayer();
    } else {
      if (pendingLayerApplyRef.current) {
        map.off("load", pendingLayerApplyRef.current);
      }
      pendingLayerApplyRef.current = applyLayer;
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
