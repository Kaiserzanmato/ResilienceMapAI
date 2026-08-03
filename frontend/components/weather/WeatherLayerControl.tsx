"use client";
import { CloudSun } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { WEATHER_LAYERS, type WeatherLayerKey } from "@/lib/weatherLayers";
import { cn } from "@/lib/utils";

export function WeatherLayerControl({
  layer,
  onChange,
}: {
  layer: WeatherLayerKey;
  onChange: (l: WeatherLayerKey) => void;
}) {
  return (
    <GlassCard strong className="w-60 px-4 py-3">
      <div className="mb-2 flex items-center gap-2 text-[13px] font-semibold">
        <CloudSun size={15} className="text-[var(--accent)]" aria-hidden="true" />
        Forecast layer
      </div>
      <div className="grid grid-cols-2 gap-1.5" role="radiogroup" aria-label="Weather layer">
        {WEATHER_LAYERS.map((l) => (
          <button
            key={l.key}
            role="radio"
            aria-checked={layer === l.key}
            onClick={() => onChange(l.key)}
            className={cn(
              "focus-ring cursor-pointer rounded-lg border px-2 py-1.5 text-[11.5px] font-medium transition-all",
              layer === l.key
                ? "border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_16%,transparent)] text-[var(--accent)]"
                : "border-[var(--surface-border)] text-[var(--fg-muted)] hover:text-[var(--fg)]"
            )}
          >
            {l.label}
          </button>
        ))}
      </div>
      <p className="mt-2 text-[10.5px] leading-relaxed text-[var(--fg-muted)]">
        Click the map for live conditions at a point. Tiles refresh every ~10 min.
      </p>
    </GlassCard>
  );
}
