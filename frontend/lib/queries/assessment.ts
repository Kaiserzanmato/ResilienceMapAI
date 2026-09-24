import type { QueryKey } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toRiskAssessment } from "@/lib/assessment-adapter";
import type { SelectedLocation } from "@/lib/store";

/** Shared by the map page's auto-fetch on selection and the "Run AI Risk
 * Assessment" button's manual re-fetch, so both read/write the exact same
 * react-query cache entry instead of drifting into two independent copies
 * of the key format. */
export function assessmentQueryKey(selected: SelectedLocation | null): QueryKey {
  return ["assessment", selected?.lat, selected?.lng, selected?.name, selected?.countryCode];
}

export async function fetchAssessment(selected: SelectedLocation) {
  return toRiskAssessment(
    await api.assessLocation({
      lat: selected.lat,
      lng: selected.lng,
      name: selected.name,
      country_code: selected.countryCode,
      geometry_type: "point",
    })
  );
}
