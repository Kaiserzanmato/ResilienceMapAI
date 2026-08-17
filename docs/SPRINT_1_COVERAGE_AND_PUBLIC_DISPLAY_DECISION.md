# Sprint 1 coverage and public-display decision

**Decision status:** Approved with conditions
**Approval record:** Issue #9, Approval 1
**Scope:** Documentation and decision preparation only. This document authorizes no code, schema, connector, ingestion, source enablement, secret, deployment, or infrastructure change.

## 1. Decision requested

Approve a phased geographic-coverage and public-display policy for deterministic multi-hazard screening. It defines when a hazard may receive a public score and how Map, Dashboard, Export, and AI disclose evidence limits.

Approval 1 was recorded in Issue #9. The coverage/public-display policy below is approved, subject to the two conditions recorded in section 8: detailed authorization, retention, deletion, and privacy controls remain subject to Approval 3; and every specialist owner must provide required evidence before implementation begins.

## 2. Approved coverage policy

### 2.1 Phased rollout

| Phase | Approved coverage | Public-score rule | Status |
| --- | --- | --- | --- |
| Phase 0 — current/legacy | Existing curated and registry-backed evidence, labeled with current limitations. | Never represent missing evidence as low risk. Preserve existing behavior until Sprint 1 is implemented. | Approved policy; implementation blocked |
| Phase 1 — Philippines-first detailed coverage | Philippines hazards supported by approved authoritative sources that meet the quality gate below. `active_fault` remains excluded until its PHIVOLCS/GeoRiskPH decision is approved. | A public component score is allowed only with accepted coverage, provenance, freshness, and quality evidence. | Approved policy; source evidence pending |
| Phase 2 — global baseline display | Global baseline only where the same quality gate passes for the relevant hazard and jurisdiction. | State baseline resolution; do not imply local detail equal to Phase 1. | Approved policy; source evidence pending |
| Phase 3 — expanded detailed coverage | Additional jurisdictions after source-by-source coverage and public-display review. | Enable per hazard and jurisdiction, never under a blanket global-coverage claim. | Approved policy; source evidence pending |

### 2.2 Recommendation and coverage unit

The approved default is Philippines-first detailed coverage using approved authoritative sources. This bounded geography supports validation of source authority, licenses, boundaries, map precision, no-data behavior, accessibility, and public wording. Each detailed result must name its hazard, source version, coverage boundary, resolution, and freshness.

Global data may be displayed only as a **global baseline** where each hazard passes the quality gate. It must state actual resolution and may not be described as detailed local coverage. A source covering one country or one hazard does not grant permission to score another.

The coverage unit is `(hazard_key, jurisdiction, coverage_geometry, resolution, source_version, as_of)`. A country label alone is insufficient for partial, coastal, urban-only, historical-only, or otherwise bounded coverage.

**Acceptance criteria:** a coverage record identifies the covered geometry or bounds, resolution, jurisdiction, hazard, source/version, freshness, and quality decision for every public score.

## 3. Public-display contract

Every public assessment view and export must use a shared server-produced snapshot. Every displayed component and overall result must expose the following fields.

| Field | Public contract |
| --- | --- |
| `coverage_status` | A section 4 machine-readable state; never inferred from a numeric score. |
| `coverage_scope` | Hazard-specific jurisdiction and geometry/bounds, distinguishing detailed coverage from global baseline. |
| `resolution` | Approved grid size or source geometry precision, with a false-precision notice where needed. |
| `as_of` | UTC assessment/snapshot timestamp. |
| `freshness_status` and `refreshed_at` | Source freshness and last accepted refresh; never a client refresh timestamp. |
| `source_summary` | Provider, source/version, attribution, and permitted provenance link. |
| `confidence` and `uncertainty` | Deterministic confidence plus material coverage, freshness, or uncertainty reason. |
| `disclaimer` | “Screening information based on available sources; not an official advisory or emergency warning.” |
| `snapshot_id` | Opaque server-issued reference when authorized; never an authorization credential. |

### Map

- Show a coverage boundary or stated jurisdiction/resolution before a layer or score can be interpreted as local detail.
- Use distinct visual treatment for detailed coverage, global baseline, stale data, and no-data. Never use a low-risk color for no-data.
- Make hazard, status, `as_of`, freshness, source/attribution, uncertainty, and disclaimer available in a tooltip or keyboard-reachable panel.
- State when a layer is evidence or an overlay rather than a score.

### Dashboard

- Aggregate only components sharing stated coverage scope and snapshot version.
- Do not compare detailed Philippines data with a global baseline as if precision were equal.
- Show coverage/freshness context on KPIs; omit unavailable components from claims instead of converting them to a favorable value.

### Export

- Include snapshot/version where authorized, coverage scope, resolution, `as_of`, freshness, source/version, attribution, uncertainty, and disclaimer.
- Preserve no-data states verbatim; never substitute zero, blank, or low risk.
- Return `suppressed` with a safe reason when source terms or privacy prohibit export; do not generate a partial undisclosed result.

### AI

- Explain only the server-provided snapshot and approved sources.
- Repeat material coverage, freshness, uncertainty, and “not an official advisory” context for risk questions; do not claim local detail from a global baseline.
- Explain no-data, stale, or suppressed components as such, never as safe or low risk. Use deterministic fallback for unsupported questions.

**Acceptance criteria:** API/UI/export/AI contract tests show the same status, scope, resolution, freshness, provenance, disclaimer, and snapshot version for one assessment.

## 4. Machine-readable display states

`coverage_status` is a closed vocabulary paired with a safe `reason_code`, not a free-text provider error.

| State | Meaning | Required UI behavior | Score behavior |
| --- | --- | --- | --- |
| `available` | Accepted data covers the requested hazard/location/resolution. | Show score, source, freshness, uncertainty, coverage, and disclaimer. | Calculate under the approved engine. |
| `not_applicable` | Hazard cannot apply to this geographic/contextual unit. | Show “Not applicable”; do not color it low risk. | Exclude by declared formula; never score zero. |
| `out_of_coverage` | Accepted source does not cover the requested location/resolution. | Show “Not covered by this source” and scope where safe. | Do not calculate or blend. |
| `unknown` | Coverage or input quality cannot be determined. | Show “Data status unknown”; do not imply safety. | Block public component scoring. |
| `unavailable` | Expected evidence is temporarily unavailable. | Show “Temporarily unavailable” and last refresh if known. | Omit, or use last-known-good only when also `stale`. |
| `stale` | Accepted data exceeds freshness target but remains within retention. | Show “Stale as of [time]”; visually distinct. | Use only if approved policy permits; lower confidence deterministically. |
| `expired` | Data exceeds validity or maximum retention. | Show “Expired; not used.” | Do not calculate or blend. |
| `suppressed` | License, privacy, safety, or policy prevents use/display. | Show “Unavailable for this view” without sensitive detail. | Do not calculate, blend, or export. |

### Non-negotiable missing-data rule

No no-data state (`not_applicable`, `out_of_coverage`, `unknown`, `unavailable`, `stale`, `expired`, or `suppressed`) may appear as low risk, safe, zero, green, or complete coverage in a component, map color, dashboard KPI, export, aggregate, or AI response.

**Acceptance criteria:** fixtures for every state prove that UI, export, and AI show required wording and never emit a low-risk score, color, or claim.

## 5. Approved public-score quality gate

A hazard may receive a public score only when every applicable requirement is met for its coverage unit. This applies independently to a Philippines detailed component and every global baseline component.

| Requirement | Approved minimum |
| --- | --- |
| Source authority | Source is allowlisted and approved authoritative, or has an approved documented exception. |
| License and provenance | License/terms, permitted public use, attribution, canonical URL, source/version, and review status are recorded and compatible with public display. |
| Geographic coverage | Coverage geometry/bounds, jurisdiction, hazard, resolution, and material exclusions are known and cover the requested unit. |
| Freshness | `refreshed_at` meets approved source-specific SLA; otherwise return a no-data/freshness state. |
| Data quality | Schema, CRS/geometry, temporal validity, completeness, and source validation pass; quality/confidence meets the approved floor. |
| Reproducibility | Accepted dataset/artifact, transform, score-engine configuration, and snapshot input manifest are retained. |
| Public wording | Coverage, uncertainty, attribution, and disclaimer appear in every applicable view. |

The approved quality floor is documented authority; known license and public-display permission; bounded geographic coverage; known resolution and temporal validity; accepted validation; and deterministic confidence. Missing a mandatory field produces a no-data state, not a public score.

**Acceptance criteria:** review fixtures reject a public score when license, coverage, source version, freshness, validation, or provenance is missing, and the approval audit identifies reviewer and evidence.

## 6. Approved location privacy, precision, and accessibility baseline

### Location privacy and precision

- Store and display only the precision necessary for approved screening use. Use the canonical score grid for ordinary Map/Dashboard/AI display unless an authorized workflow requires more precision.
- Treat original selected coordinates and saved history as sensitive data. Do not put them in public URLs, client logs, telemetry, AI prompts, provenance, or unauthenticated exports.
- Show: “Results apply to the displayed grid or source resolution, not an exact property boundary.”
- Do not claim parcel, building, household, evacuation, insurance, or emergency-response precision without later separately approved policy and source data.
- Apply Approval 3 authorization, retention, deletion, and audit rules once approved; do not expand persistent precise-location use before then.

### Accessibility

- Do not rely on color alone. Pair color with text, icon, legend, and programmatic status.
- Make status, freshness, source attribution, uncertainty, and disclaimer keyboard reachable and available to assistive technology.
- Use plain language for no-data and avoid “safe” wording when evidence is absent or stale.
- Provide equivalent disclosure in Export and AI, not only map-hover content.

**Acceptance criteria:** keyboard and screen-reader review finds every state and disclaimer without color or map hover; precision limits appear in Map, Dashboard, Export, and AI.

## 7. Approvers, evidence, deadline, and effect if unapproved

### Required approvers

| Role | Responsibility |
| --- | --- |
| Product manager — owner | Coverage phases, user-visible behavior, and rollout boundary. |
| Data governance lead | Source authority, provenance, license/display eligibility, and quality gate. |
| Hazard-science lead | Coverage meaning, uncertainty language, and no-advisory boundary. |
| Geospatial engineering lead | Geometry, resolution, coverage representation, and false-precision constraints. |
| Accessibility/content lead | No-data wording, non-color presentation, and accessible disclosure. |
| Privacy/legal reviewer | Location precision, public limitations, attribution, and source terms. |

### Evidence required

- Per-hazard/source inventory: jurisdiction, bounds/geometry, resolution, authority, freshness SLA, exclusions, and source-version provenance.
- Completed quality-gate and license/attribution/public-display review for every proposed Phase 1 and Phase 2 source.
- Map, Dashboard, Export, and AI prototypes or test fixtures for every state.
- Privacy review of coordinate precision, persistence, export, and telemetry.
- Product review naming permitted global baseline claims and excluded hazards/jurisdictions.

### Approval acceptance criteria

- The record names Phase 1 Philippines hazards/sources and any permitted Phase 2 global baseline hazards/jurisdictions.
- Every approved coverage unit has quality-gate evidence and an explicit coverage/resolution/freshness/provenance contract.
- All eight states have approved wording and accessible behavior; missing data cannot appear low risk.
- Public disclaimer, precision, and attribution language is approved for Map, Dashboard, Export, and AI.
- The decision and evidence are linked in Issue #9 before an implementation ticket begins.

### Effective gate and implementation effect

- This approval is effective immediately as a policy gate, before Approval 2 source selection and before any Sprint 1 engineering ticket, schema, connector, or public-display work.
- Implementation remains blocked until every specialist owner provides required evidence, source-specific quality evidence is accepted, and Approvals 2–5 are complete. The team may continue read-only source discovery and documentation only.

## 8. Recorded Approval 1 decisions and conditions

1. **Approved:** Philippines-first detailed coverage for Phase 1. Global information remains hazard-by-hazard baseline coverage and must not imply local precision.
2. **Approved:** No-data must never be presented as low risk, safe, zero, green, or complete coverage.
3. **Approved:** Require coverage, resolution, freshness, provenance, uncertainty, and “screening information, not an official advisory” disclosure across Map, Dashboard, Export, and AI.
4. **Approved:** Require source-by-source authority, licensing, provenance, coverage, freshness, validation, reproducibility, and disclosure evidence before a public score is shown.
5. **Approved with condition:** Apply canonical-grid precision, sensitive-location safeguards, accessible non-color disclosures, and keyboard/screen-reader access as policy. Detailed authorization, retention, deletion, and privacy controls remain subject to Approval 3.
6. **Approved with condition:** Adopt the proposed approvers, evidence package, and gate. Each specialist owner must provide required evidence before implementation begins.

**Final status:** Approval 1 is Approved with conditions. Sprint 1 implementation remains blocked until source-specific evidence is accepted and Approvals 2–5 are approved.
