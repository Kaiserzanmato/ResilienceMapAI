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

/** The selected layer's hazard first and marked active, the rest in their original order. */
export function orderHazards<T>(hazards: Record<string, T>, activeLayer: string): OrderedHazard<T>[] {
  const activeKey = LAYER_TO_HAZARD[activeLayer];
  const entries = Object.entries(hazards).map(([key, hazard]) => ({ key, hazard, active: key === activeKey }));
  return [...entries.filter((e) => e.active), ...entries.filter((e) => !e.active)];
}
