# Sprint 1 Approval 1 — USGS earthquake coverage dossier

**Status:** Draft only — `PENDING HUMAN APPROVAL`

**Approval record:** Issue #9, Approval 1

**Scope:** Documentation and evidence collection only. This dossier authorizes no runtime code, ingestion, scoring, database schema, feature flag, deployment, secret, configuration, source enablement, public display, export, or AI change.

## 1. Candidate source and intended limited scope

| Field | Draft record |
| --- | --- |
| Candidate source | United States Geological Survey (USGS) earthquake GeoJSON summary feeds. Repository research links the official [USGS feeds documentation](https://earthquake.usgs.gov/earthquakes/feed/) and [FDSN event service documentation](https://earthquake.usgs.gov/fdsnws/event/1/index). |
| Candidate hazard | `earthquake` |
| Intended initial use | Evidence-only candidate for the first completed source-acceptance and Approval 3 scoring-evidence records. It is not approved as a score input, overlay, connector, or public display source. |
| Source authority evidence | The repository research record classifies USGS as a Tier 5 scientific authority and records that its GeoJSON summary feeds expose FeatureCollections with event IDs, geometry, UTC timestamps, magnitude, place, and detail URL. See [USGS research record](research/providers/USGS.md). |
| Jurisdiction and coverage geometry | `PENDING HUMAN APPROVAL` |
| Coverage phase | `PENDING HUMAN APPROVAL` — Approval 1 permits Philippines-first detailed coverage and separately permits a global baseline only after the quality gate passes. This dossier does not select either. |
| Source record ID/version | `PENDING HUMAN APPROVAL` |
| Baseline or overlay eligibility | `PENDING HUMAN APPROVAL` — active events and alerts must remain separate from baseline scoring unless a later approved, versioned policy says otherwise. |

The repository research record notes a successful point-in-time probe on 2026-08-13 and recommends a five-minute shared fetch. Neither fact is an approved availability commitment, freshness SLA, polling interval, or authorization to implement one.

## 2. Coverage, exclusions, resolution, and precision boundaries

### Required approval decisions

| Topic | Draft position |
| --- | --- |
| Approved geographic unit | `PENDING HUMAN APPROVAL` — record jurisdiction and coverage geometry/bounds, not a country label alone. |
| Detailed versus global-baseline classification | `PENDING HUMAN APPROVAL` |
| Supported earthquake event types, time window, and event-status rules | `PENDING HUMAN APPROVAL` |
| Source geometry/resolution and any grid precision | `PENDING HUMAN APPROVAL` |
| Material exclusions and coverage gaps | `PENDING HUMAN APPROVAL` |
| Public-score eligibility | `PENDING HUMAN APPROVAL` — no score may be shown until all Approval 1 quality-gate fields are accepted. |

### Exclusions and non-claims

- Do not represent the candidate as Philippines detailed coverage, global coverage, local coverage, a hazard forecast, an official advisory, or an emergency warning unless the relevant evidence and approval are recorded.
- Do not infer a score, confidence value, coverage boundary, source priority, formula, threshold, grid size, or location precision from the source name, an event geometry, or existing behavior.
- Treat original selected coordinates and saved location history as sensitive. Ordinary future displays must use only the approved canonical-grid or source-resolution precision, after privacy approval.
- Use the disclosure: “Results apply to the displayed grid or source resolution, not an exact property boundary,” only after the required public wording is approved for the selected scope.

## 3. Authority, provenance, attribution, and licensing evidence needed

### Evidence currently recorded

- [USGS research record](research/providers/USGS.md) links official documentation and records the listed GeoJSON fields and source URL requirement.
- [Source-quality and provenance matrix](SPRINT_1_SOURCE_QUALITY_PROVENANCE_MATRIX.md) defines the required acceptance fields and states that a template is not an approved source record.

### Evidence required before acceptance

| Required artifact | Minimum contents | Status |
| --- | --- | --- |
| Source acceptance record | Source ID, organization, hazard, jurisdiction, coverage geometry, feature kind, authority basis, canonical delivery URL, decision date, renewal date, and evidence links. | `PENDING HUMAN APPROVAL` |
| License and public-use review | Applicable terms; processing, derivative, display, attribution, export, retention, and sharing permissions/restrictions; legal reviewer decision. | `PENDING HUMAN APPROVAL` |
| Attribution record | Exact approved attribution wording and source-link treatment for Map, Dashboard, Export, and AI. | `PENDING HUMAN APPROVAL` |
| Artifact/version provenance record | Official delivery channel; retrieved artifact/release/version/date; hash algorithm/value; retrieval and acceptance timestamps; immutable evidence reference. | `PENDING HUMAN APPROVAL` |
| Validation record | Identity, schema/data dictionary, geometry/CRS, temporal-validity, completeness, checksum, and change-handling results. | `PENDING HUMAN APPROVAL` |

No license, public-display permission, derivative-use permission, export permission, retention permission, attribution wording, schema contract, or source priority is inferred by this dossier.

## 4. Freshness, staleness, and safe no-data behavior

| Topic | Required decision or evidence |
| --- | --- |
| Freshness SLA and measurement clock | `PENDING HUMAN APPROVAL` |
| Maximum staleness and permitted last-known-good use | `PENDING HUMAN APPROVAL` |
| Retrieval cadence, timeout, response cap, retry, and cache policy | `PENDING HUMAN APPROVAL` |
| Upstream schema/availability monitoring and escalation owner | `PENDING HUMAN APPROVAL` |
| Closed no-data outcome for each failure or coverage condition | `PENDING HUMAN APPROVAL` |

Until accepted source-specific rules exist, use no public component score. Any future response must preserve the closed status vocabulary from [Approval 1](SPRINT_1_COVERAGE_AND_PUBLIC_DISPLAY_DECISION.md): `unknown`, `out_of_coverage`, `unavailable`, `stale`, `expired`, or `suppressed`, as applicable. No such state may be represented as low risk, safe, zero, green, or complete coverage.

## 5. Public Map, Dashboard, AI, and Export disclosure requirements

If this candidate is approved for a future public surface, every rendered result must carry the Approval 1 contract below. Exact copy and permitted field values remain `PENDING HUMAN APPROVAL` until source acceptance and public-wording review finish.

| Surface | Required disclosure |
| --- | --- |
| Map | Hazard, coverage scope/boundary, resolution, `as_of`, freshness, source/version, attribution, uncertainty, status, and “screening information based on available sources; not an official advisory or emergency warning.” Do not use a low-risk visual treatment for no-data. |
| Dashboard | Coverage and freshness beside every KPI; do not aggregate or compare scopes of unequal precision as equivalent; preserve no-data rather than using a favorable default. |
| AI | Explain only an authorized server-produced snapshot; repeat material coverage, freshness, uncertainty, source limitations, and no-advisory context; use deterministic fallback for unsupported questions. |
| Export | Include authorized snapshot/version, coverage scope, resolution, `as_of`, freshness, source/version, attribution, uncertainty, and disclaimer; return `suppressed` rather than exporting prohibited information. |

## 6. Accessibility and privacy-review dependencies

### Accessibility dependencies

- `PENDING HUMAN APPROVAL`: approved plain-language wording for every coverage and freshness state.
- `PENDING HUMAN APPROVAL`: keyboard and screen-reader fixture review for status, freshness, attribution, uncertainty, and disclaimer.
- `PENDING HUMAN APPROVAL`: non-color presentation (text, icon, legend, and programmatic status) for all state distinctions.

### Privacy dependencies

- `PENDING HUMAN APPROVAL`: Approval 4 decision on coordinate precision, collection, persistence, export, telemetry, retention, deletion, audit access, and provider sharing.
- `PENDING HUMAN APPROVAL`: privacy/legal review of any source metadata, provenance visibility, user location, export, and AI-context handling.
- No precise location, prompt, credential, or secret may appear in public URLs, ordinary telemetry, client logs, or unauthenticated exports.

## 7. Required Source Acceptance and Approval 3 links

The following records must be completed and linked before this candidate can affect a deterministic score or public result:

| Gate | Required linked artifact | Current status |
| --- | --- | --- |
| Source Acceptance | A completed `USGS / earthquake / [approved jurisdiction] / [approved feature kind]` record following the [source-quality matrix](SPRINT_1_SOURCE_QUALITY_PROVENANCE_MATRIX.md). | `PENDING HUMAN APPROVAL` |
| Approval 3 formula evidence | A completed `earthquake` worksheet in the [scoring evidence package](SPRINT_1_SCORING_EVIDENCE_PACKAGE_TEMPLATE.md), referencing the accepted source record, approved formula, fixtures, and parity limits. | `PENDING HUMAN APPROVAL` |
| Approval 4 | Approved authorization, privacy, audit, retention/deletion, provider, and abuse-control evidence where the future surface requires it. | `PENDING HUMAN APPROVAL` |
| Approval 5 | Approved numeric freshness, capacity, cost, RPO/RTO, alert, and rollback evidence where the future surface requires it. | `PENDING HUMAN APPROVAL` |

## 8. Owners, reviewers, and sign-off fields

| Role | Required sign-off or review | Name/date/evidence link |
| --- | --- | --- |
| Product manager — Approval 1 owner | Coverage phase, public behavior, exclusions, and disclosure boundary. | `PENDING HUMAN APPROVAL` |
| Data-governance lead | Authority, provenance, source acceptance, license/display eligibility, quality gate, and freshness record. | `PENDING HUMAN APPROVAL` |
| Hazard-science lead | Earthquake meaning, uncertainty language, and any future formula/overlay boundary. | `PENDING HUMAN APPROVAL` |
| Geospatial engineering lead | Geometry, resolution, coverage representation, and false-precision constraints. | `PENDING HUMAN APPROVAL` |
| Accessibility/content lead | No-data wording and accessible disclosure evidence. | `PENDING HUMAN APPROVAL` |
| Privacy/legal reviewer | Location precision, retention/deletion, public limitations, and source terms. | `PENDING HUMAN APPROVAL` |
| Security/privacy lead | Authorization, audit, abuse-control, and data-sharing controls under Approval 4. | `PENDING HUMAN APPROVAL` |
| Platform/SRE owner | Freshness measurement, resilience, alerting, and operational limits under Approval 5. | `PENDING HUMAN APPROVAL` |

## 9. Decision log

| Date | Decision | Status | Evidence link |
| --- | --- | --- | --- |
| `PENDING HUMAN APPROVAL` | Candidate selection: earthquake / USGS GeoJSON for documentation-only evidence collection. | Draft; not source acceptance. | [USGS research record](research/providers/USGS.md) |
| `PENDING HUMAN APPROVAL` | Coverage phase, jurisdiction, geometry, and resolution. | Not decided. | `PENDING HUMAN APPROVAL` |
| `PENDING HUMAN APPROVAL` | License, permitted use, attribution, export, retention, and sharing terms. | Not decided. | `PENDING HUMAN APPROVAL` |
| `PENDING HUMAN APPROVAL` | Freshness SLA, staleness limit, and last-known-good rule. | Not decided. | `PENDING HUMAN APPROVAL` |
| `PENDING HUMAN APPROVAL` | Baseline versus overlay eligibility and all formula values. | Not decided. | `PENDING HUMAN APPROVAL` |
| `PENDING HUMAN APPROVAL` | Public-surface wording, accessibility review, and privacy approval. | Not decided. | `PENDING HUMAN APPROVAL` |

## 10. Active-fault deferral and no-go status

`active_fault` is formally deferred. No PHIVOLCS/GeoRiskPH connector, layer, distance display, proximity output, score claim, safety claim, probability claim, or public display is permitted until Approval 2 accepts written authorization and a reproducible approved artifact with the required licensing, provenance, validation, and scientific evidence.

**Decision status: NO-GO.** This dossier is a draft evidence request only. Sprint 1 implementation remains blocked pending completed source acceptance, Approval 3 formula evidence, Approval 4 controls, Approval 5 numeric/operational evidence, and the required non-production drills.
