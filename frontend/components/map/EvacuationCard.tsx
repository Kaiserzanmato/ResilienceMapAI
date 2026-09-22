"use client";
import { Navigation, X } from "lucide-react";
import type { CSSProperties } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import type { EvacuationCenterWithDistance } from "@/lib/evacuation-centers";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<string, string> = {
  Open: "text-emerald-400 bg-emerald-400/15",
  "Near Capacity": "text-amber-400 bg-amber-400/15",
  Full: "text-red-400 bg-red-400/15",
  Standby: "text-sky-400 bg-sky-400/15",
};

export function EvacuationCard({
  center,
  onClose,
  style,
  className,
}: {
  center: EvacuationCenterWithDistance;
  onClose: () => void;
  style?: CSSProperties;
  className?: string;
}) {
  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${center.lat},${center.lng}`;

  return (
    <GlassCard
      strong
      style={{
        maxHeight: "calc(100vh - var(--banner-h, 0px) - var(--nav-h, 0px) - var(--footer-h, 0px) - 48px)",
        overflowY: "auto",
        ...style,
      }}
      className={cn("w-72 space-y-3 p-4 text-[13px]", className)}
      role="dialog"
      aria-label={`Evacuation center: ${center.name}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-[13.5px] font-semibold leading-tight">{center.name}</h3>
          <span
            className={cn(
              "mt-1 inline-block rounded-full px-2 py-0.5 text-[10.5px] font-semibold",
              STATUS_STYLES[center.capacityStatus] ?? "text-[var(--fg-muted)] bg-[color-mix(in_srgb,var(--fg)_12%,transparent)]"
            )}
          >
            {center.capacityStatus}
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close evacuation center card"
          className="focus-ring shrink-0 cursor-pointer rounded-full p-1 text-[var(--fg-muted)] hover:text-[var(--fg)]"
        >
          <X size={15} aria-hidden="true" />
        </button>
      </div>

      <p className="text-[12px] leading-snug text-[var(--fg-muted)]">{center.address}</p>
      <p className="text-[10.5px] font-medium uppercase tracking-wider text-[var(--fg-muted)]">
        {center.distanceKm.toFixed(1)} km away
      </p>

      {center.safetyInstructions.length > 0 && (
        <div>
          <p className="mb-1 text-[10.5px] font-semibold uppercase tracking-wider text-[var(--fg-muted)]">
            Safety instructions
          </p>
          <ul className="space-y-1 text-[12px] leading-snug">
            {center.safetyInstructions.map((instruction, i) => (
              <li key={i} className="flex gap-1.5">
                <span aria-hidden="true">•</span>
                <span>{instruction}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex items-center gap-2 pt-1">
        <a
          href={directionsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="focus-ring flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-[var(--accent)] px-3 py-2 text-[12.5px] font-semibold text-white"
        >
          <Navigation size={13} aria-hidden="true" />
          Get Directions
        </a>
        <button
          type="button"
          onClick={onClose}
          className="focus-ring cursor-pointer rounded-lg border border-[var(--surface-border)] px-3 py-2 text-[12.5px] font-medium text-[var(--fg-muted)] hover:text-[var(--fg)]"
        >
          Close
        </button>
      </div>
    </GlassCard>
  );
}
