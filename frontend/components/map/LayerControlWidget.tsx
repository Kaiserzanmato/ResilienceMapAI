"use client";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, Globe, Layers, LifeBuoy, Map as MapIcon, X } from "lucide-react";
import { api } from "@/lib/api";
import { FLAGS } from "@/lib/feature-flags";
import { MAP_VIEWS } from "@/lib/mapStyles";
import { useAppStore, type MapProjection } from "@/lib/store";
import { cn } from "@/lib/utils";
import { GlassCard } from "@/components/ui/GlassCard";
import { Icon } from "@/components/ui/Icon";

const PROJECTIONS: { key: MapProjection; label: string; icon: typeof Globe }[] = [
  { key: "mercator", label: "2D Map", icon: MapIcon },
  { key: "globe", label: "3D Globe", icon: Globe },
];

function Toggle({
  label, checked, onChange, icon,
}: { label: string; checked: boolean; onChange: (v: boolean) => void; icon?: typeof Globe }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg px-1 py-1.5 text-[13px]">
      <span className="flex items-center gap-1.5">
        {icon && <Icon icon={icon} size="inline" className="text-[var(--fg-muted)]" />}
        {label}
      </span>
      <button
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={cn(
          "focus-ring relative h-5.5 w-10 shrink-0 cursor-pointer rounded-full transition-colors",
          checked ? "bg-[var(--accent)]" : "bg-[color-mix(in_srgb,var(--fg)_18%,transparent)]"
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            "absolute top-0.5 h-4.5 w-4.5 rounded-full bg-white shadow transition-all",
            checked ? "left-[calc(100%-20px)]" : "left-0.5"
          )}
        />
      </button>
    </label>
  );
}

function RadioPill({
  label, checked, onClick, icon: Icon,
}: { label: string; checked: boolean; onClick: () => void; icon?: typeof Globe }) {
  return (
    <button
      role="radio"
      aria-checked={checked}
      onClick={onClick}
      className={cn(
        "focus-ring flex cursor-pointer items-center justify-center gap-1 rounded-lg border px-1 py-1.5 text-[11px] font-medium transition-all",
        checked
          ? "border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_16%,transparent)] text-[var(--accent)]"
          : "border-[var(--surface-border)] text-[var(--fg-muted)] hover:text-[var(--fg)]"
      )}
    >
      {Icon && <Icon size={12} aria-hidden="true" />}
      {label}
    </button>
  );
}

export function LayerControlWidget({ onCollapse, collapseStyle = "chevron" }: {
  /** Slides the whole dock away (the dock shows a floating "Map Layers" button to bring it back). */
  onCollapse?: () => void;
  /** chevron: docked on desktop. close: dismissible flyout on tablet and phones. */
  collapseStyle?: "chevron" | "close";
}) {
  const {
    mapView, setMapView, mapProjection, setMapProjection, activeLayer, setActiveLayer,
    showZones, setShowZones, showHeatmap, setShowHeatmap,
    showAlerts, setShowAlerts, showEvents, setShowEvents,
    showEvacuationCenters, setShowEvacuationCenters, showFloodExtents, setShowFloodExtents,
  } = useAppStore();

  const { data: layerIndex } = useQuery({ queryKey: ["layer-index"], queryFn: api.layerIndex });

  return (
    <GlassCard strong className="w-full max-w-60 overflow-hidden sm:w-60">
      <div className="flex w-full items-center gap-2 px-4 py-3 text-[13px] font-semibold">
        <Layers size={15} className="text-[var(--accent)]" aria-hidden="true" />
        <h2 className="min-w-0 flex-1 truncate text-[13px] font-semibold">Map Layers</h2>
        {onCollapse && (
          <button
            type="button"
            onClick={onCollapse}
            aria-label={collapseStyle === "close" ? "Close Map Layers" : "Collapse Map Layers"}
            className="focus-ring -my-2 -mr-2 flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-lg text-[var(--fg-muted)] hover:text-[var(--fg)]"
          >
            {collapseStyle === "close" ? <X size={16} aria-hidden="true" /> : <ChevronLeft size={16} aria-hidden="true" />}
          </button>
        )}
      </div>

      <div className="space-y-4 px-4 pb-4">
        <div>
          <p className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-[var(--fg-muted)]">
            Map view
          </p>
          <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="Map view">
            {MAP_VIEWS.map((v) => (
              <RadioPill
                key={v.key}
                label={v.label}
                checked={mapView === v.key}
                onClick={() => setMapView(v.key)}
              />
            ))}
          </div>
          <div className="mt-1.5 grid grid-cols-2 gap-1.5" role="radiogroup" aria-label="Map projection">
            {PROJECTIONS.map(({ key, label, icon }) => (
              <RadioPill
                key={key}
                label={label}
                icon={icon}
                checked={mapProjection === key}
                onClick={() => setMapProjection(key)}
              />
            ))}
          </div>
        </div>

        <div>
          <p className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-[var(--fg-muted)]">
            Hazard layer
          </p>
          <select
            value={activeLayer}
            onChange={(e) => setActiveLayer(e.target.value)}
            aria-label="Hazard layer"
            className="focus-ring w-full cursor-pointer rounded-lg border border-[var(--surface-border)] bg-[var(--surface-solid)] px-2.5 py-2 text-[13px]"
          >
            {(layerIndex?.layers ?? [{ key: "overall", label: "Overall Risk" }]).map((l) => (
              <option key={l.key} value={l.key}>
                {l.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <p className="mb-0.5 text-[10.5px] font-semibold uppercase tracking-wider text-[var(--fg-muted)]">
            Overlays
          </p>
          <Toggle label="Risk zones" checked={showZones} onChange={setShowZones} />
          <Toggle label="Heatmap" checked={showHeatmap} onChange={setShowHeatmap} />
          <Toggle label="Active alerts" checked={showAlerts} onChange={setShowAlerts} />
          <Toggle label="Historical events" checked={showEvents} onChange={setShowEvents} />
          {FLAGS.FLOOD_CAPTURE && (
            <Toggle label="Satellite flood extent" checked={showFloodExtents} onChange={setShowFloodExtents} />
          )}
        </div>

        <div>
          <p className="mb-0.5 text-[10.5px] font-semibold uppercase tracking-wider text-[var(--fg-muted)]">
            Critical infrastructure
          </p>
          <Toggle
            label="Show nearest evacuation centers"
            icon={LifeBuoy}
            checked={showEvacuationCenters}
            onChange={setShowEvacuationCenters}
          />
        </div>
      </div>
    </GlassCard>
  );
}
