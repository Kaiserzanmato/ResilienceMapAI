"use client";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { AlertTriangle, ExternalLink, Satellite } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { WeatherLayerControl } from "@/components/weather/WeatherLayerControl";
import { WeatherLegend } from "@/components/weather/WeatherLegend";
import { WEATHER_LAYERS, type WeatherLayerKey } from "@/lib/weatherLayers";

// Lazy-load the map (heaviest bundle) — same pattern as the risk map page
const WeatherMap = dynamic(() => import("@/components/weather/WeatherMap"), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 flex items-center justify-center text-sm text-[var(--fg-muted)]">
      Loading weather map…
    </div>
  ),
});

type KeyStatus = "ok" | "missing" | "pending" | "error" | null;

export default function WeatherPage() {
  const [layer, setLayer] = useState<WeatherLayerKey>(WEATHER_LAYERS[0].key);
  const [keyStatus, setKeyStatus] = useState<KeyStatus>(null);

  useEffect(() => {
    fetch("/api/weather-current?lat=0&lon=0")
      .then((res) => {
        if (res.status === 503) setKeyStatus("missing");
        else if (res.status === 401) setKeyStatus("pending");
        else if (res.ok) setKeyStatus("ok");
        else setKeyStatus("error");
      })
      .catch(() => setKeyStatus("error"));
  }, []);

  return (
    <div className="fixed inset-0 top-0">
      <WeatherMap layer={layer} />

      {keyStatus === "missing" && (
        <div
          className="pointer-events-none absolute inset-x-0 z-20 flex justify-center px-3"
          style={{ bottom: "calc(var(--footer-h) + 76px)" }}
        >
          <GlassCard
            strong
            className="pointer-events-auto flex max-w-lg items-center gap-2 px-4 py-2.5 text-[12px]"
          >
            <AlertTriangle size={14} className="shrink-0 text-[var(--risk-medium)]" aria-hidden="true" />
            Live forecast tiles need a free OpenWeatherMap API key — set{" "}
            <code className="rounded bg-[color-mix(in_srgb,var(--fg)_10%,transparent)] px-1 py-0.5">
              OPENWEATHERMAP_API_KEY
            </code>{" "}
            on the server (sign up at openweathermap.org/api, free tier).
          </GlassCard>
        </div>
      )}

      {keyStatus === "pending" && (
        <div
          className="pointer-events-none absolute inset-x-0 z-20 flex justify-center px-3"
          style={{ bottom: "calc(var(--footer-h) + 76px)" }}
        >
          <GlassCard
            strong
            className="pointer-events-auto flex max-w-lg items-center gap-2 px-4 py-2.5 text-[12px]"
          >
            <AlertTriangle size={14} className="shrink-0 text-[var(--risk-medium)]" aria-hidden="true" />
            OpenWeatherMap key found but not active yet — new keys can take up
            to 2 hours to activate. Tiles will start working automatically.
          </GlassCard>
        </div>
      )}

      {keyStatus === "error" && (
        <div
          className="pointer-events-none absolute inset-x-0 z-20 flex justify-center px-3"
          style={{ bottom: "calc(var(--footer-h) + 76px)" }}
        >
          <GlassCard
            strong
            className="pointer-events-auto flex max-w-lg items-center gap-2 px-4 py-2.5 text-[12px]"
          >
            <AlertTriangle size={14} className="shrink-0 text-[var(--risk-medium)]" aria-hidden="true" />
            Couldn&apos;t reach the weather service — check your connection or
            try reloading. If this persists, an ad-blocker or proxy may be
            blocking the request.
          </GlassCard>
        </div>
      )}

      {/* Layer switcher — top-left, below nav */}
      <div
        className="pointer-events-none absolute left-3 z-20 hidden md:block"
        style={{ top: "calc(var(--banner-h) + var(--nav-h) + 36px)" }}
      >
        <div className="pointer-events-auto">
          <WeatherLayerControl layer={layer} onChange={setLayer} />
        </div>
      </div>

      {/* Mobile layer switcher */}
      <div
        className="pointer-events-none absolute inset-x-3 z-20 md:hidden"
        style={{ top: "calc(var(--banner-h) + var(--nav-h) + 12px)" }}
      >
        <div className="pointer-events-auto">
          <WeatherLayerControl layer={layer} onChange={setLayer} />
        </div>
      </div>

      {/* Color-scale legend — bottom-left, above footer */}
      <div
        className="pointer-events-none absolute left-3 z-20 hidden sm:block"
        style={{ bottom: "calc(var(--footer-h) + 12px)" }}
      >
        <div className="pointer-events-auto">
          <WeatherLegend layer={layer} />
        </div>
      </div>

      {/* Zoom.Earth link-out — bottom-right, above footer */}
      <div
        className="pointer-events-none absolute right-3 z-20"
        style={{ bottom: "calc(var(--footer-h) + 12px)" }}
      >
        <GlassCard strong className="pointer-events-auto flex max-w-xs items-center gap-3 px-4 py-3">
          <Satellite size={20} className="shrink-0 text-[var(--accent)]" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="text-[12.5px] font-semibold">Want the full storm-tracking view?</p>
            <p className="text-[11px] text-[var(--fg-muted)]">
              Zoom.Earth has live satellite loops &amp; cyclone tracks.
            </p>
          </div>
          <a
            href="https://zoom.earth/maps/satellite/"
            target="_blank"
            rel="noopener noreferrer"
            className="focus-ring flex shrink-0 items-center gap-1 rounded-lg border border-[var(--surface-border)] px-2.5 py-1.5 text-[11.5px] font-medium transition-all hover:border-[var(--accent)] hover:text-[var(--accent)]"
          >
            Open <ExternalLink size={12} aria-hidden="true" />
          </a>
        </GlassCard>
      </div>
    </div>
  );
}
