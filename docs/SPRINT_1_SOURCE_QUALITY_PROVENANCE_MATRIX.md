# Sprint 1 source quality and provenance matrix

**Status:** Proposed / Pending data-governance approval
**Purpose:** Matrix template for the Approval 3 source-resolution evidence package. It authorizes no source connector, ingestion, score, public display, deployment, or configuration change.

## 1. Completion rule

Create one record for every `(source, hazard, jurisdiction, feature kind)` that could affect a future deterministic score or overlay. Populate only repository-verifiable or supplied evidence. Every unknown value is `Unknown / Pending`; do not infer licenses, quality, cadence, coverage, confidence, or source priority.

`active_fault` remains `unavailable`/`out_of_coverage`. No PHIVOLCS/GeoRiskPH endpoint, artifact, ingestion, proximity display, score, safety claim, or probability claim is authorized without written source authorization and Approval 2 evidence.

## 2. Matrix record template

| Field | Required record |
| --- | --- |
| Matrix record ID / version | `Unknown / Pending` |
| Source ID and organization | `Unknown / Pending` |
| Hazard key | `Unknown / Pending` |
| Jurisdiction and coverage geometry/bounds | `Unknown / Pending` |
| Feature kind / record class | `Unknown / Pending` |
| Authority basis | `Unknown / Pending` |
| License, terms, and permitted use | `Unknown / Pending` |
| Required attribution and public-display/export restrictions | `Unknown / Pending` |
| Canonical source URL or approved delivery channel | `Unknown / Pending` |
| Artifact/release/version/date and canonical hash algorithm/value | `Unknown / Pending` |
| Coverage, resolution, scale, and material exclusions | `Unknown / Pending` |
| CRS, geometry type, schema/data dictionary, and temporal validity | `Unknown / Pending` |
| Source priority and approval rationale | Proposed / Pending data-governance approval |
| Canonical mapping, aliases, deduplication key/rule | Proposed / Pending data-governance approval |
| Conflict rule and equal-rank outcome | Proposed / Pending data-governance approval |
| Validation evidence: identity, schema, geometry, completeness, checksum | `Unknown / Pending` |
| Quality tier and deterministic confidence inputs | Proposed / Pending data-governance approval |
| Freshness SLA, `refreshed_at`, maximum staleness, and last-known-good rule | Proposed / Pending data-governance approval |
| Closed no-data outcome | Proposed / Pending data-governance approval |
| Required public disclosure: coverage, freshness, provenance, uncertainty, advisory limitation | `Unknown / Pending` |
| Overlay or baseline eligibility | Proposed / Pending scientific/data-governance approval |
| Reviewers, evidence links, decision date, renewal date | `Unknown / Pending` |

## 3. Required hazard coverage rows

Create rows for `earthquake`, `flood`, `tropical_cyclone`, `landslide`, `storm_surge`, `historical_event`, `volcano` legacy compatibility, and `active_fault` for every proposed source/jurisdiction/feature-kind combination. A missing row is not evidence of low risk or source eligibility.

For `volcano`, record legacy adapter/no-data behavior separately from future scoring eligibility. For `historical_event`, record time period, completeness, and recurrence limitations. For `active_fault`, record only `unavailable`/`out_of_coverage` until written PHIVOLCS/GeoRiskPH authorization and validation evidence are attached.

## 4. Closed no-data outcomes

| State | Matrix use |
| --- | --- |
| `available` | May be proposed only after authority, license, provenance, coverage, validation, freshness, and quality evidence pass. |
| `not_applicable` | Hazard cannot apply; never a score of zero. |
| `out_of_coverage` | Source does not cover the location/resolution; do not calculate or blend. |
| `unknown` | Coverage, quality, or provenance cannot be determined; block public score. |
| `unavailable` | Expected source cannot currently provide eligible data; omit or use approved last-known-good only when stale. |
| `stale` | Data exceeds SLA but remains within an approved maximum age; use only under an approved deterministic policy. |
| `expired` | Do not use, display as current, or blend. |
| `suppressed` | License, privacy, safety, or policy prevents use/display/export. |

No state may be converted to low risk, safe, zero, green, complete coverage, or a favorable default.

## 5. Evidence acceptance criteria

Each completed record requires data-governance review plus scientific, legal/licensing, geospatial, product, and security/privacy review where their control is affected. Acceptance requires:

- documented authority, license/terms, permitted public/derivative/export use, attribution, and renewal obligation;
- immutable artifact/version/hash, CRS/geometry/schema, coverage/resolution, temporal validity, and validation evidence;
- approved source priority, canonical mapping/deduplication, conflict rule, quality/confidence calibration, freshness SLA, maximum staleness, and no-data outcome;
- approved public disclosure of coverage, resolution, freshness, provenance, uncertainty, and “screening information, not an official advisory”; and
- test fixtures showing deterministic source resolution, duplicate handling, conflicts, stale/no-data behavior, and immutable snapshot reproduction.

## 6. Versioning and snapshot inclusion

An approved matrix record receives an immutable ID/version and evidence hash. A score manifest must include the matrix record ID/version, source/artifact/version/hash, priority/conflict outcome, quality/confidence inputs, freshness/no-data outcome, and public-disclosure references used for the assessment.

Only the server may resolve matrix records into an authorized immutable snapshot. Map, Dashboard, Export, and AI consume that same snapshot. AI is explanation-only; client-provided source, score, or context cannot select or alter the matrix result.

## 7. Final gate

This template is not an approved matrix. Source precedence, confidence, freshness, deduplication, and conflict handling remain unapproved until completed records are evidence-backed and approved. Formula/scoring evidence, Approvals 4–5, and source-specific evidence remain blocking requirements.
