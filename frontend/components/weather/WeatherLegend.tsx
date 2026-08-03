"use client";
import { GlassCard } from "@/components/ui/GlassCard";
import { WEATHER_LEGENDS, WEATHER_LAYERS, type WeatherLayerKey } from "@/lib/weatherLayers";

export function WeatherLegend({ layer }: { layer: WeatherLayerKey }) {
  const legend = WEATHER_LEGENDS[layer];
  const label = WEATHER_LAYERS.find((l) => l.key === layer)?.label ?? layer;

  return (
    <GlassCard strong className="flex items-center gap-3 px-4 py-2.5">
      <span className="shrink-0 text-[11.5px] font-medium text-[var(--accent)]">{label}</span>
      <span className="text-[10.5px] text-[var(--fg-muted)]">{legend.min}</span>
      <div
        className="h-2.5 w-32 shrink-0 rounded-full"
        style={{ background: legend.gradient }}
        aria-hidden="true"
      />
      <span className="text-[10.5px] text-[var(--fg-muted)]">{legend.max}</span>
    </GlassCard>
  );
}
