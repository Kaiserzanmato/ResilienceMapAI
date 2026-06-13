"use client";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, Crosshair, Radar } from "lucide-react";
import { useState } from "react";
import { api } from "@/lib/api";
import { useAppStore } from "@/lib/store";
import { cn, riskColor } from "@/lib/utils";
import { GlassCard } from "@/components/ui/GlassCard";

interface ZoneProps {
  name: string;
  score: number;
  level: string;
  color: string;
  lat: number;
  lng: number;
}

/** Intelligence Markers widget: prioritized high-risk locations and active
 * alerts — click any entry to zoom the map to it. */
export function IntelligenceMarkersWidget() {
  const [open, setOpen] = useState(false);
  const setSelected = useAppStore((s) => s.setSelected);

  const { data: zones } = useQuery({
    queryKey: ["zones", "overall"],
    queryFn: () => api.hazardLayers("overall", "geojson"),
  });
  const { data: eventsData } = useQuery({
    queryKey: ["hazard-events"],
    queryFn: api.hazardEvents,
  });

  const topZones = (zones?.features ?? [])
    .map((f) => f.properties as unknown as ZoneProps)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
  const alerts = eventsData?.alerts ?? [];

  return (
    <GlassCard strong className="w-60 overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="focus-ring flex w-full cursor-pointer items-center gap-2 px-4 py-3 text-[13px] font-semibold"
      >
        <Radar size={15} className="text-[var(--risk-high)]" aria-hidden="true" />
        Intelligence Markers
        <ChevronDown
          size={14}
          className={cn("ml-auto transition-transform", open && "rotate-180")}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div className="space-y-3 px-4 pb-4 max-h-[50vh] overflow-y-auto">
          <div>
            <p className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-[var(--fg-muted)]">
              Prioritized high-risk areas
            </p>
            <ul className="space-y-1">
              {topZones.map((z) => (
                <li key={z.name}>
                  <button
                    onClick={() => setSelected({ lat: z.lat, lng: z.lng, name: z.name })}
                    className="focus-ring flex w-full cursor-pointer items-center gap-2 rounded-lg px-1.5 py-1.5 text-left text-[12px] transition-colors hover:bg-[color-mix(in_srgb,var(--fg)_8%,transparent)]"
                  >
                    <Crosshair size={12} className="shrink-0 text-[var(--fg-muted)]" aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate font-medium">{z.name}</span>
                    <span className="font-semibold" style={{ color: riskColor(z.color) }}>
                      {z.score}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {alerts.length > 0 && (
            <div>
              <p className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-[var(--fg-muted)]">
                Active alerts
              </p>
              <ul className="space-y-1">
                {alerts.map((a) => (
                  <li key={a.id}>
                    <button
                      onClick={() => setSelected({ lat: a.lat, lng: a.lng, name: a.area })}
                      className="focus-ring flex w-full cursor-pointer items-start gap-2 rounded-lg px-1.5 py-1.5 text-left text-[11.5px] transition-colors hover:bg-[color-mix(in_srgb,var(--fg)_8%,transparent)]"
                    >
                      <span
                        aria-hidden="true"
                        className="mt-1 h-2 w-2 shrink-0 animate-pulse rounded-full"
                        style={{
                          background: a.severity === "High" ? "var(--risk-high)" : "var(--risk-medium)",
                        }}
                      />
                      <span className="min-w-0">
                        <span className="block truncate font-medium leading-snug">{a.title}</span>
                        <span className="block text-[10.5px] text-[var(--fg-muted)]">
                          {a.area} · {a.severity} · {a.source}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </GlassCard>
  );
}
