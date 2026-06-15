/**
 * Hazard Score Array Utility - Token Efficiency Layer
 *
 * Converts hazard objects to compressed positional arrays per architecture spec:
 * [0: Flood, 1: Earthquake, 2: Cyclone, 3: StormSurge, 4: Volcano, 5: Landslide,
 *  6: Drought, 7: Wildfire, 8: ExtremeHeat, 9: Conflict, 10: CivilUnrest]
 */

export const HAZARD_INDEX_MAP = {
  flood: 0,
  earthquake: 1,
  tropical_cyclone: 2,
  storm_surge: 3,
  volcano: 4,
  landslide: 5,
  drought: 6,
  wildfire: 7,
  extreme_heat: 8,
  conflict: 9,
  environmental: 10,
} as const;

export const HAZARD_LABELS_INDEXED = [
  "Flood",
  "Earthquake",
  "Tropical Cyclone",
  "Storm Surge",
  "Volcano",
  "Landslide",
  "Drought",
  "Wildfire",
  "Extreme Heat",
  "Conflict/War",
  "Environmental",
] as const;

/**
 * Convert hazard object to compressed array format for token efficiency
 * Example: { flood: 74, earthquake: 6, ... } → [74, 6, 87, 82, 0, 0, ...]
 */
export function compressHazardScores(
  hazards: Record<string, { score: number | null }>
): number[] {
  const compressed = new Array(11).fill(0);

  for (const [key, hazard] of Object.entries(hazards)) {
    const normalizedKey = key.replace(/_/g, "_").toLowerCase();
    const index = (HAZARD_INDEX_MAP as Record<string, number>)[normalizedKey];

    if (index !== undefined && hazard.score !== null) {
      compressed[index] = Math.round(hazard.score);
    }
  }

  return compressed;
}

/**
 * Convert compressed array back to labeled object for UI display
 */
export function expandHazardArray(arr: number[]): Record<string, number> {
  const expanded: Record<string, number> = {};

  HAZARD_LABELS_INDEXED.forEach((label, index) => {
    const key = Object.keys(HAZARD_INDEX_MAP).find(
      (k) => (HAZARD_INDEX_MAP as Record<string, number>)[k] === index
    );
    if (key) {
      expanded[key] = arr[index] ?? 0;
    }
  });

  return expanded;
}

/**
 * Format hazard array for human-readable system prompt injection
 * Returns: "[Flood: 74, Earthquake: 6, Cyclone: 87, ...]"
 */
export function formatHazardArrayForPrompt(arr: number[]): string {
  return (
    "[" +
    HAZARD_LABELS_INDEXED.map((label, index) => `${label}: ${arr[index] ?? 0}`)
      .join(", ") +
    "]"
  );
}
