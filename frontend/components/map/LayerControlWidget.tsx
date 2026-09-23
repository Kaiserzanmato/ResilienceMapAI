"use client";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, Globe, Layers, Map as MapIcon } from "lucide-react";
import { useState, useSyncExternalStore } from "react";
import { api } from "@/lib/api";
import { MAP_VIEWS } from "@/lib/mapStyles";
import { useAppStore, type MapProjection } from "@/lib/store";
import { cn } from "@/lib/utils";
import { GlassCard } from "@/components/ui/GlassCard";

const PROJECTIONS: { key: MapProjection; label: string; icon: typeof Globe }[] = [
  { key: "mercator", label: "2D Map", icon: MapIcon },
  { key: "globe", label: "3D Globe", icon: Globe },
];

function Toggle({
  label, checked, onChange,
}: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg px-1 py-1.5 text-[13px]">
      {label}
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

// Subscribe to the desktop media query so the widget defaults open on
// desktop but collapsed on mobile (no overlapping panels on small screens)
const desktopQuery = "(min-width: 768px)";
const subscribeDesktop = (cb: () => void) => {
  const mq = window.matchMedia(desktopQuery);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};
const useIsDesktop = () =>
  useSyncExternalStore(
    subscribeDesktop,
    () => window.matchMedia(desktopQuery).matches,
    () => true
  );

export function LayerControlWidget() {
  const isDesktop = useIsDesktop();
  const [userToggled, setUserToggled] = useState<boolean | null>(null);
  const open = userToggled ?? isDesktop;
  const setOpen = (fn: (v: boolean) => boolean) => setUserToggled(fn(open));
  const {
    mapView, setMapView, mapProjection, setMapProjection, activeLayer, setActiveLayer,
    showZones, setShowZones, showHeatmap, setShowHeatmap,
    showAlerts, setShowAlerts, showEvents, setShowEvents,
    showEvacuationCenters, setShowEvacuationCenters,
  } = useAppStore();

  const { data: layerIndex } = useQuery({ queryKey: ["layer-index"], queryFn: api.layerIndex });

  return (
    <GlassCard strong className="w-60 overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="focus-ring flex w-full cursor-pointer items-center gap-2 px-4 py-3 text-[13px] font-semibold"
      >
        <Layers size={15} className="text-[var(--accent)]" aria-hidden="true" />
        Map Layers
        <ChevronDown
          size={14}
          className={cn("ml-auto transition-transform", open && "rotate-180")}
          aria-hidden="true"
        />
      </button>

      {open && (
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
          </div>

          <div>
            <p className="mb-0.5 text-[10.5px] font-semibold uppercase tracking-wider text-[var(--fg-muted)]">
              Critical infrastructure
            </p>
            <Toggle
              label="🏫 Show Nearest Evacuation Centers"
              checked={showEvacuationCenters}
              onChange={setShowEvacuationCenters}
            />
          </div>
        </div>
      )}
    </GlassCard>
  );
}
