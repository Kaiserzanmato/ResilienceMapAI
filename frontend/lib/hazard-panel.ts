/** Risk-panel ordering that follows the selected map layer. Pure; no imports
 * (tests/hazard-panel.test.mjs). */

/** Map layer key -> hazard key in the assessment (they differ for storm surge). */
export const LAYER_TO_HAZARD: Record<string, string> = {
  flood: "flood",
  earthquake: "earthquake",
  tropical_cyclone: "tropical_cyclone",
  volcano: "volcano",
  landslide: "landslide",
  storm_surge: "coastal_exposure",
};

export interface OrderedHazard<T> {
  key: string;
  hazard: T;
  active: boolean;
}

/** The selected layer's hazard first and marked active, the rest in their original order.
 * With no layer selected (Overall Risk), rows are sorted by score, highest first; hazards
 * without a score go last, and ties keep their original order. */
export function orderHazards<T>(hazards: Record<string, T>, activeLayer: string): OrderedHazard<T>[] {
  const activeKey = LAYER_TO_HAZARD[activeLayer];
  const entries = Object.entries(hazards).map(([key, hazard]) => ({ key, hazard, active: key === activeKey }));
  if (activeKey === undefined) {
    const scoreOf = (h: T) => {
      const s = (h as { score?: number | null } | null)?.score;
      return typeof s === "number" ? s : -1;
    };
    return entries.map((e, i) => ({ e, i })).sort((a, b) => scoreOf(b.e.hazard) - scoreOf(a.e.hazard) || a.i - b.i).map(({ e }) => e);
  }
  return [...entries.filter((e) => e.active), ...entries.filter((e) => !e.active)];
}
