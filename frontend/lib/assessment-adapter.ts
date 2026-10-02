import type { GlobalAssessment, HazardScore, RiskAssessment, RiskLevel } from "./types";

function riskLevel(score: number | null): RiskLevel {
  if (score === null) return { score: null, level: "No Data", color: "gray" };
  if (score <= 25) return { score, level: "Low", color: "green" };
  if (score <= 60) return { score, level: "Medium", color: "yellow" };
  return { score, level: "High", color: "red" };
}

/** Keep legacy widgets, reports, and AI consumers compatible with the
 * registry-driven endpoint while preserving null as no-data. */
export function toRiskAssessment(assessment: GlobalAssessment): RiskAssessment {
  const hazards: Record<string, HazardScore> = Object.fromEntries(
    Object.entries(assessment.hazards).map(([key, hazard]) => [
      key,
      {
        label: hazard.label,
        ...riskLevel(hazard.score),
        coverage_status: hazard.coverage_status,
        reason_code: hazard.reason_code,
        // Volcanic has no zone-model indicator: it is scored from licensed data or shows no number.
        indicative_score: key === "volcano" ? null : hazard.indicative_score ?? null,
        indicative_source_type: key === "volcano" ? undefined : hazard.indicative_source_type,
        ...(hazard.note ? { note: hazard.note } : {}),
        ...(hazard.link ? { link: hazard.link } : {}),
      },
    ]),
  );
  const scores = Object.values(hazards).map((hazard) => hazard.score).filter((score): score is number => score !== null);
  // Overall reflects only components with available evidence; the widget discloses
  // how many that is. Missing components are excluded, never counted as zero.
  const overallScore = scores.length >= 1 ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : null;
  const coverage = assessment.multi_hazard_summary.coverage_score;
  return {
    location_name: assessment.location.name,
    latitude: assessment.location.latitude,
    longitude: assessment.location.longitude,
    overall: riskLevel(overallScore),
    components_available: scores.length,
    components_total: Object.keys(hazards).length,
    hazards,
    main_drivers: assessment.multi_hazard_summary.highest_priority_hazards.map((key) => hazards[key]?.label ?? key),
    nearest_zone: null,
    data_coverage: coverage >= 70 ? "covered" : coverage >= 30 ? "regional" : "limited",
    confidence: coverage >= 70 ? "High" : coverage >= 30 ? "Medium" : "Low",
    generated_at: assessment.generated_at,
    methodology: `Registry-driven multi-hazard assessment (${assessment.coverage_registry_version}). ${assessment.disclaimer}`,
    engine_version: assessment.scoring_version,
  };
}
