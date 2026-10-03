import {
  Activity,
  CloudRainWind,
  Flame,
  Funnel,
  Leaf,
  MoveDown,
  Mountain,
  MountainSnow,
  ShieldAlert,
  Sun,
  Thermometer,
  Waves,
  WavesArrowUp,
  Waypoints,
  Wind,
  type LucideIcon,
} from "lucide-react";

/** One colour-blind-safe icon per hazard key (lib/hazard-utils.ts
 * HAZARD_INDEX_MAP), shown next to the label in the risk panel. Shape carries
 * the meaning; colour (risk level) is layered separately via riskColor(). */
export const HAZARD_ICONS: Record<string, LucideIcon> = {
  flood: Waves,
  earthquake: Activity,
  tropical_cyclone: Wind,
  storm_surge: CloudRainWind,
  coastal_exposure: CloudRainWind, // storm-surge hazard key in the assessment payload
  volcano: Mountain,
  landslide: MountainSnow,
  drought: Sun,
  wildfire: Flame,
  extreme_heat: Thermometer,
  conflict: ShieldAlert,
  environmental: Leaf,
  active_fault: Waypoints,
  tsunami: WavesArrowUp,
  land_subsidence: MoveDown,
  sinkhole: Funnel,
};

export function getHazardIcon(key: string): LucideIcon | undefined {
  return HAZARD_ICONS[key];
}
