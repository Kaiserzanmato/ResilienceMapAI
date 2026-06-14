"use client";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { api } from "@/lib/api";
import { cn, riskColor } from "@/lib/utils";
import { axisProps, ChartCard, tooltipStyle } from "./ChartCard";

const PRESETS = [
  { name: "Metro Manila", lat: 14.5995, lng: 120.9842 },
  { name: "Cebu City", lat: 10.3157, lng: 123.8854 },
  { name: "Tacloban City", lat: 11.2447, lng: 125.0026 },
  { name: "Davao City", lat: 7.1907, lng: 125.4553 },
  { name: "Legazpi (Mayon)", lat: 13.1391, lng: 123.7438 },
  { name: "Baguio City", lat: 16.4023, lng: 120.596 },
];

const HAZARD_COLS: { key: string; label: string }[] = [
  { key: "flood", label: "Flood" },
  { key: "earthquake", label: "Quake" },
  { key: "tropical_cyclone", label: "Cyclone" },
  { key: "volcano", label: "Volcano" },
  { key: "landslide", label: "Landslide" },
  { key: "storm_surge", label: "Surge" },
];

export function LocationComparisonCard({
  index = 0,
  className,
}: {
  index?: number;
  className?: string;
}) {
  const [active, setActive] = useState<string[]>([]); // Start empty to defer API call
  const [hasInteracted, setHasInteracted] = useState(false);

  const selected = PRESETS.filter((p) => active.includes(p.name));
  // Only fetch after user interaction
  const { data } = useQuery({
    queryKey: ["compare", ...active],
    queryFn: () => api.compare(selected),
    enabled: selected.length >= 2 && hasInteracted,
  });

  function toggle(name: string) {
    setHasInteracted(true);
    setActive((prev) => {
      if (prev.includes(name)) {
        return prev.length > 2 ? prev.filter((n) => n !== name) : prev;
      }
      return prev.length < 4 ? [...prev, name] : prev;
    });
  }

  const results = data?.results ?? [];
  const chartData = results.map((r) => ({
    name: r.location_name,
    score: r.overall.score ?? 0,
    color: r.overall.color,
  }));

  // Show placeholder if no locations selected
  if (!hasInteracted || active.length === 0) {
    return (
      <ChartCard
        title="Location Comparison"
        sub="Compare overall and per-hazard scores across areas (2–4 locations)"
        index={index}
        className={className}
      >
        <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Locations to compare">
          {PRESETS.map((p) => (
            <button
              key={p.name}
              aria-pressed={false}
              onClick={() => toggle(p.name)}
              className="focus-ring cursor-pointer rounded-full border border-[var(--surface-border)] px-3 py-1.5 text-[12px] font-medium text-[var(--fg-muted)] transition-all hover:text-[var(--fg)]"
            >
              {p.name}
            </button>
          ))}
        </div>
        <div className="flex items-center justify-center py-12 text-center">
          <p className="text-[13px] text-[var(--fg-muted)]">
            Select 2–4 locations above to compare
          </p>
        </div>
      </ChartCard>
    );
  }

  return (
    <ChartCard
      title="Location Comparison"
      sub="Compare overall and per-hazard scores across areas (2–4 locations)"
      index={index}
      className={className}
    >
      <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Locations to compare">
        {PRESETS.map((p) => (
          <button
            key={p.name}
            aria-pressed={active.includes(p.name)}
            onClick={() => toggle(p.name)}
            className={cn(
              "focus-ring cursor-pointer rounded-full border px-3 py-1.5 text-[12px] font-medium transition-all",
              active.includes(p.name)
                ? "border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_14%,transparent)] text-[var(--accent)]"
                : "border-[var(--surface-border)] text-[var(--fg-muted)] hover:text-[var(--fg)]"
            )}
          >
            {p.name}
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chartData} layout="vertical" barSize={18}>
            <XAxis type="number" {...axisProps} domain={[0, 100]} hide />
            <YAxis type="category" dataKey="name" {...axisProps} width={108} tick={{ fontSize: 10 }} />
            <Tooltip {...tooltipStyle} />
            <Bar dataKey="score" name="Overall" radius={[0, 6, 6, 0]}>
              {chartData.map((d) => (
                <Cell key={d.name} fill={riskColor(d.color)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-[12px]">
            <thead>
              <tr className="text-left text-[10.5px] uppercase tracking-wider text-[var(--fg-muted)]">
                <th className="pb-2 pr-3 font-semibold">Location</th>
                <th className="pb-2 pr-3 font-semibold">Overall</th>
                {HAZARD_COLS.map((h) => (
                  <th key={h.key} className="pb-2 pr-3 font-semibold">{h.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {results.map((r) => (
                <tr key={r.location_name} className="border-t border-[var(--surface-border)]">
                  <td className="py-2 pr-3 font-medium">{r.location_name}</td>
                  <td
                    className="py-2 pr-3 font-semibold"
                    style={{ color: riskColor(r.overall.color) }}
                  >
                    {r.overall.score ?? "—"} · {r.overall.level}
                  </td>
                  {HAZARD_COLS.map((h) => {
                    const hz = r.hazards[h.key];
                    return (
                      <td
                        key={h.key}
                        className="py-2 pr-3 font-semibold"
                        style={{ color: riskColor(hz?.color) }}
                      >
                        {hz?.score ?? "—"}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </ChartCard>
  );
}
