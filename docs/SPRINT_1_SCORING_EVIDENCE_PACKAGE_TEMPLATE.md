# Sprint 1 scoring evidence package template

**Status:** Proposed / Pending scientific approval
**Purpose:** Evidence template for the Approval 3 formula package. It authorizes no scoring code, data ingestion, source enablement, schema, deployment, or configuration change.

## 1. Completion rule

Complete one hazard section for every score-bearing component. All formulas, weights, thresholds, ranges, caps/floors, confidence calibration, curves, rounding rules, and acceptance limits are **Unknown / Pending scientific approval** until a named scientific and data owner approves them with evidence.

Do not invent numeric values. Use `Unknown / Pending` where a source, value, rationale, or test result is not repository-verifiable.

AI is explanation-only. It cannot calculate, select, alter, infer, or fill in any value in this package. Client-provided scores or context are never evidence and cannot be authoritative.

## 2. Package metadata

| Field | Required value |
| --- | --- |
| Package ID | `Unknown / Pending` |
| Score engine/configuration version | `Unknown / Pending` |
| Taxonomy version | `Unknown / Pending` |
| Prepared by / date | `Unknown / Pending` |
| Scientific owner / approver | `Unknown / Pending` |
| Data-governance owner / approver | `Unknown / Pending` |
| Product owner / approver | `Unknown / Pending` |
| Evidence repository/links | `Unknown / Pending` |
| Decision status | Proposed / Pending scientific approval |

## 3. Required hazard worksheets

Create and approve one worksheet for each row before it can affect a deterministic baseline score.

| Hazard / compatibility item | Eligible baseline status | Required worksheet status |
| --- | --- | --- |
| `earthquake` | Unknown / Pending formula approval | Proposed / Pending |
| `flood` | Unknown / Pending formula approval | Proposed / Pending |
| `tropical_cyclone` | Unknown / Pending formula approval | Proposed / Pending |
| `landslide` | Unknown / Pending formula approval | Proposed / Pending |
| `storm_surge` | Unknown / Pending formula approval | Proposed / Pending |
| `historical_event` | Evidence only; never a current alert | Proposed / Pending |
| `volcano` legacy compatibility | Compatibility only; do not silently drop or reinterpret | Proposed / Pending |
| `active_fault` | **Unavailable / out_of_coverage** under Approval 2 | No scoring worksheet may be approved until written PHIVOLCS/GeoRiskPH authorization and source evidence are accepted |

### Hazard worksheet template

Copy this block for every listed hazard.

#### Hazard key: `[hazard_key]`

| Decision field | Required evidence or status |
| --- | --- |
| Record class and taxonomy mapping | `Unknown / Pending` |
| Intended meaning and prohibited interpretations | `Unknown / Pending` |
| Eligible baseline inputs | `Unknown / Pending` |
| Ineligible inputs / overlay-only inputs | `Unknown / Pending` |
| Source-quality matrix record IDs | `Unknown / Pending` |
| Formula identifier and human-readable rule | Proposed / Pending scientific approval |
| Input units, bounds, normalization | Proposed / Pending scientific approval |
| Component range and overall-score contribution | Proposed / Pending scientific approval |
| Weight, blend, cap, floor, and missing-data behavior | Proposed / Pending scientific approval |
| Thresholds, scoring curve, and uncertainty policy | Proposed / Pending scientific approval |
| Confidence calibration rule | Proposed / Pending scientific approval |
| Rounding mode, output precision, and tie-break | Proposed / Pending scientific approval |
| Stale/expired/no-data treatment | Proposed / Pending scientific approval |
| Required public wording and “not an official advisory” disclosure | `Unknown / Pending` |
| Scientific rationale and citations | `Unknown / Pending` |
| Fixture IDs and expected unrounded/rounded results | `Unknown / Pending` |
| Shadow-comparison acceptance limits | Proposed / Pending scientific approval |
| Approver decision/date/signature reference | `Unknown / Pending` |

### Historical-event worksheet requirements

Historical events must record period, completeness, geography, event definition, and uncertainty. They may not imply a current event, forecast, warning, safety conclusion, or official advisory. Whether and how they contribute to a baseline remains Proposed / Pending scientific approval.

### Volcano legacy-compatibility worksheet requirements

Record the current legacy mapping, adapter behavior, and explicit no-data behavior for Sprint 1-only responses. Do not silently remove, reinterpret, or score `volcano` until a separate approved policy defines it.

### Active-fault worksheet requirements

`active_fault` must remain `unavailable`/`out_of_coverage`. Do not ingest fault data, calculate distance, display proximity, assign a score, make safety claims, or make probability/activity claims unless written PHIVOLCS/GeoRiskPH authorization and the Approval 2 artifact, licensing, provenance, validation, and scientific evidence gates are accepted. Any future distance-to-risk curve or weight remains Proposed / Pending scientific approval.

## 4. Overlay worksheet

Active events and authoritative alerts are separate from baseline scoring. For each overlay, record issuer, event/alert ID, jurisdiction, validity window, retraction/expiry, source/version, public wording, and evidence. An overlay must not alter a baseline score, component, confidence, or formula unless a later versioned policy is separately approved.

## 5. Required evidence and acceptance criteria

Before a hazard formula is approved, provide:

- scientific rationale for each formula, threshold, weight, range, cap/floor, curve, confidence rule, and missing-data decision;
- source-quality/provenance matrix references for every input source;
- fixed fixtures with canonical input manifests and expected unrounded/rounded components, overall scores, ties, overlays, stale states, and no-data states;
- shadow comparison against the current engine with acceptance limits approved by scientific, data-governance, and product owners;
- public wording showing uncertainty, coverage, freshness, provenance, and screening/not-an-official-advisory limitations.

Acceptance requires named scientific, data-governance, product, geospatial, backend/platform, security/privacy, and AI-platform reviewers where their owned control is affected. No approval may be inferred from an empty field, existing behavior, AI output, or a client request.

## 6. Versioning and immutable snapshot inclusion

After approval, include the package ID, hazard worksheet/version IDs, formula/configuration hash, source-quality matrix record IDs, approved evidence references, and fixture version in the immutable score manifest. The server must produce an opaque, authorized snapshot ID containing the canonical query, `as_of`, accepted source/artifact versions, no-data/freshness states, unrounded/rounded components, and deterministic explanation.

Map, Dashboard, Export, and AI must consume the same server-authorized immutable snapshot. A new formula, evidence package, source, or configuration creates a new score-engine version and snapshot; it never changes a historical snapshot.

## 7. Final gate

This template is not an approval. Formula implementation remains blocked until each relevant worksheet is complete, evidence-backed, scientifically and data-governance approved, versioned, and linked to Issue #9. Approvals 4–5 and source-specific evidence also remain blocking requirements.
