export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/** Basic structural validation for a source API response. */
export function validateSourceResponse(
  sourceId: string,
  payload: unknown
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (payload === null || payload === undefined) {
    errors.push(`[${sourceId}] Response is null or undefined`);
    return { valid: false, errors, warnings };
  }

  if (typeof payload !== "object") {
    errors.push(`[${sourceId}] Response is not an object (got ${typeof payload})`);
    return { valid: false, errors, warnings };
  }

  if (Array.isArray(payload) && payload.length === 0) {
    warnings.push(`[${sourceId}] Response array is empty — may indicate no current events`);
  }

  return { valid: errors.length === 0, errors, warnings };
}

/** Validate a GeoJSON FeatureCollection from USGS or similar. */
export function validateGeoJsonResponse(
  sourceId: string,
  payload: unknown
): ValidationResult {
  const base = validateSourceResponse(sourceId, payload);
  if (!base.valid) return base;

  const obj = payload as Record<string, unknown>;
  if (obj.type !== "FeatureCollection") {
    base.errors.push(`[${sourceId}] Expected GeoJSON FeatureCollection, got type="${obj.type}"`);
    base.valid = false;
  }
  if (!Array.isArray(obj.features)) {
    base.errors.push(`[${sourceId}] Missing 'features' array`);
    base.valid = false;
  }

  return base;
}

/** Check if source data is stale based on freshness threshold. */
export function isDataStale(
  lastSuccessfulSyncAt: string | undefined,
  syncFrequencyMinutes: number
): boolean {
  if (!lastSuccessfulSyncAt) return true;
  const lastSync = new Date(lastSuccessfulSyncAt).getTime();
  const thresholdMs = syncFrequencyMinutes * 60 * 1000 * 3;
  return Date.now() - lastSync > thresholdMs;
}
