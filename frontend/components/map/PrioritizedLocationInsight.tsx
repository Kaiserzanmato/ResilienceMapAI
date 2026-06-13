"use client";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronDown,
  Clock,
  ExternalLink,
  Flame,
  History,
  Shield,
  Zap,
} from "lucide-react";
import { useState } from "react";
import { PrioritizedLocation } from "@/lib/prioritized-locations";
import { cn, riskColor } from "@/lib/utils";
import { GlassCard } from "@/components/ui/GlassCard";

interface Props {
  location: PrioritizedLocation;
}

function scoreToColor(score: number): string {
  if (score >= 61) return "red";
  if (score >= 26) return "yellow";
  return "green";
}

export function PrioritizedLocationInsight({ location }: Props) {
  const [expanded, setExpanded] = useState(false);
  const colorKey = scoreToColor(location.score);

  const hazardIcon: Record<string, React.ReactNode> = {
    "Tropical Cyclone": <Zap size={14} />,
    "Storm Surge": <Flame size={14} />,
    Volcano: <Flame size={14} />,
    Lahars: <Zap size={14} />,
    Flooding: <Zap size={14} />,
    Hurricane: <Zap size={14} />,
  };

  return (
    <GlassCard strong className="w-60 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        className="focus-ring flex w-full cursor-pointer items-start gap-3 px-4 py-3 text-left"
      >
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold leading-tight text-white">
            {location.name}
          </p>
          <p className="text-[10.5px] text-[var(--fg-muted)] mt-0.5">
            Why this area is prioritized
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span
            className="text-sm font-bold"
            style={{ color: riskColor(colorKey) }}
          >
            {location.score}
          </span>
          <ChevronDown
            size={14}
            className={cn(
              "transition-transform text-[var(--fg-muted)]",
              expanded && "rotate-180"
            )}
            aria-hidden="true"
          />
        </div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="border-t border-[var(--surface-border)] overflow-hidden"
          >
            <div className="space-y-4 px-4 py-3">
              {/* Risk Summary */}
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <Shield size={13} className="text-[var(--accent)]" />
                  <p className="text-[10.5px] font-semibold uppercase tracking-wider text-[var(--fg-muted)]">
                    Risk Overview
                  </p>
                </div>
                <div className="space-y-1 text-[12px] text-[var(--fg)]">
                  <p>
                    <span className="text-[var(--fg-muted)]">Risk Level:</span>{" "}
                    <span
                      className="font-semibold"
                      style={{ color: riskColor(colorKey) }}
                    >
                      {location.level} ({location.score}/100)
                    </span>
                  </p>
                </div>
              </div>

              {/* Primary Hazards */}
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <Zap size={13} className="text-[var(--accent)]" />
                  <p className="text-[10.5px] font-semibold uppercase tracking-wider text-[var(--fg-muted)]">
                    Primary Hazards
                  </p>
                </div>
                <div className="flex flex-wrap gap-1">
                  {location.primaryHazards.map((hazard) => (
                    <span
                      key={hazard}
                      className="inline-flex items-center gap-1 rounded-full bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] px-2 py-0.5 text-[11px] font-medium text-[var(--accent)]"
                    >
                      {hazardIcon[hazard] && (
                        <span className="flex shrink-0">{hazardIcon[hazard]}</span>
                      )}
                      {hazard}
                    </span>
                  ))}
                </div>
              </div>

              {/* Justification */}
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <Shield size={13} className="text-[var(--accent)]" />
                  <p className="text-[10.5px] font-semibold uppercase tracking-wider text-[var(--fg-muted)]">
                    Why Prioritized
                  </p>
                </div>
                <p className="text-[12px] text-[var(--fg)] leading-relaxed">
                  {location.historicalContext.justification}
                </p>
              </div>

              {/* Historical Events */}
              {location.historicalContext.events.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <History size={13} className="text-[var(--accent)]" />
                    <p className="text-[10.5px] font-semibold uppercase tracking-wider text-[var(--fg-muted)]">
                      Historical Events
                    </p>
                  </div>
                  <div className="space-y-2">
                    {location.historicalContext.events.map((event, idx) => (
                      <div
                        key={idx}
                        className="rounded-lg bg-[color-mix(in_srgb,var(--surface)_50%,transparent)] p-2 border border-[var(--surface-border)]"
                      >
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <div>
                            <p className="text-[11.5px] font-semibold text-white leading-snug">
                              {event.name}
                            </p>
                            <p className="text-[10px] text-[var(--fg-muted)]">
                              {event.year}
                            </p>
                          </div>
                          <span
                            className={cn(
                              "text-[9px] font-semibold px-1.5 py-0.5 rounded-full shrink-0",
                              event.source.verified
                                ? "bg-[color-mix(in_srgb,#22c55e_16%,transparent)] text-[#22c55e]"
                                : "bg-[color-mix(in_srgb,#eab308_16%,transparent)] text-[#eab308]"
                            )}
                          >
                            {event.source.verified ? "Verified" : "Pending"}
                          </span>
                        </div>
                        <p className="text-[11px] text-[var(--fg)] leading-relaxed mb-1.5">
                          {event.description}
                        </p>
                        <div className="flex items-center gap-1">
                          <span className="text-[9.5px] text-[var(--fg-muted)]">
                            Source: {event.source.name}
                          </span>
                          {event.source.url && (
                            <a
                              href={event.source.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[var(--accent)] hover:underline"
                              aria-label={`Visit ${event.source.name}`}
                            >
                              <ExternalLink size={10} />
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Preparedness Notes */}
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <Clock size={13} className="text-[var(--accent)]" />
                  <p className="text-[10.5px] font-semibold uppercase tracking-wider text-[var(--fg-muted)]">
                    Preparedness
                  </p>
                </div>
                <p className="text-[12px] text-[var(--fg)] leading-relaxed whitespace-pre-wrap">
                  {location.preparednessNotes}
                </p>
              </div>

              {/* Data Freshness */}
              <div className="pt-2 border-t border-[var(--surface-border)]">
                <p className="text-[9px] text-[var(--fg-muted)]">
                  Risk scores computed by deterministic risk engine. Historical references from
                  official government agencies (PHIVOLCS, PAGASA, NOAA, NDRRMC).
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </GlassCard>
  );
}
