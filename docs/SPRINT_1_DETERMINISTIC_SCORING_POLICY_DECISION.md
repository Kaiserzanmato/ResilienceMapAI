# Sprint 1 deterministic scoring policy decision

**Decision status:** Proposed / Pending Approval
**Approval record:** Issue #9, Approval 3
**Scope:** Documentation and decision preparation only. This record authorizes no application code, schema, scoring change, source enablement, dataset ingestion, secret, deployment, or infrastructure change.

## 1. Decision requested

Approve the deterministic policy that will govern a future versioned multi-hazard scoring engine. The decision must establish the taxonomy, eligible evidence, calculation rules, source resolution, confidence/no-data semantics, reproducibility contract, and approval evidence before any scoring implementation begins.

AI remains explanation-only. It may explain an authorized server-produced snapshot but must never calculate, alter, select, infer, or fill in a score, hazard, source, certainty, or coverage claim. Client-provided scores, arrays, map context, timestamps, or provenance are presentation hints only and can never be authoritative.

## 2. Hazard taxonomy and compatibility decision

### 2.1 Canonical taxonomy proposed for approval

| Class | Canonical use | Score rule |
| --- | --- | --- |
| Hazard phenomenon | `earthquake`, `flood`, `tropical_cyclone`, `landslide`, `storm_surge`, and legacy `volcano`. | Category only; not a score record. |
| Exposure feature | `active_fault` and similar geographic conditions. | May contribute only through an approved exposure formula; never implies an event, activity, probability, or advisory. |
| Active event | Time-bounded observed event from an accepted provider. | Overlay only unless a later versioned rule explicitly authorizes baseline use. |
| Alert | Authoritative, issuer- and validity-bounded warning/advisory. | Overlay only; never synthesized from non-authoritative evidence. |
| Historical event | Past observed impact/recurrence evidence. | Baseline evidence only under an approved formula; never a current warning. |
| Derived score component | Deterministic output for one hazard from accepted inputs. | The only score-bearing record. |

Canonical Sprint 1 keys are `earthquake`, `flood`, `tropical_cyclone`, `landslide`, `active_fault`, `storm_surge`, and `historical_event`. Each has a versioned taxonomy identifier and explicit aliases/mappings.

### 2.2 Existing-vocabulary compatibility mapping

| Existing key | Proposed compatibility rule |
| --- | --- |
| `earthquake`, `flood`, `tropical_cyclone`, `landslide`, `storm_surge` | Preserve the key through a versioned adapter; no silent semantic change. |
| `volcano` | Retain as legacy/non-Sprint-1 compatibility data. A Sprint 1-only response must emit an explicit no-data state rather than silently remove it. |
| `active_fault` | New exposure feature, not an earthquake event or forecast. Under merged Approval 2, it remains `unavailable`/`out_of_coverage` until written PHIVOLCS/GeoRiskPH authorization and source-specific evidence are accepted. |
| `historical_event` | New recurrence/evidence input; never a live alert. |

**Acceptance criteria:** each source feature has exactly one record class, canonical ID, source/version, and mapping; legacy adapters produce an explicit status; no UI or AI path confuses exposure, event, alert, or historical evidence.

## 3. Baseline inputs versus live overlays

### Proposed baseline rule

Baseline scores may use only accepted, durable, versioned hazard features and historical evidence valid at the immutable `as_of` timestamp. Every input must have approved source, coverage, temporal validity, quality, and provenance.

### Proposed overlay rule

Active events and authoritative alerts are separately versioned overlays containing event/alert ID, issuer, jurisdiction, validity window, and expiry/retraction state. An overlay may be displayed beside a baseline score but cannot change its numeric baseline value, component, confidence, or narrative meaning unless a future score-engine version explicitly approves that behavior with scientific evidence.

`active_fault` is not a baseline input or overlay until Approval 2’s written authorization and validation evidence are complete. It must not be used as a proxy for earthquake probability or safety.

**Acceptance criteria:** fixed fixtures show that an event/alert changes overlay content only; expired/retracted overlays disappear from current display but remain auditable; unapproved or no-data inputs cannot affect a baseline calculation.

## 4. Formula, range, and deterministic calculation decision

The approvers must select and publish one canonical calculation policy before implementation. It must specify:

1. Per-hazard formula, input units/bounds, component scale, and overall score range.
2. Overall blend, per-hazard weights, caps/floors, inclusion/exclusion behavior, and treatment of missing components.
3. Output precision, named decimal rounding mode, and the point in the calculation where rounding occurs.
4. Stable tie-breaking by canonical ID when equally ranked accepted inputs remain after conflict resolution.
5. A policy for score changes: formula/configuration changes require a new `score_engine_version`; they never mutate historical snapshots.

### Options requiring approval

| Option | Trade-off |
| --- | --- |
| Preserve current max/mean blend as parity comparator only | Lowest migration risk; may retain calibration limitations. |
| Adopt a new per-hazard expert-approved formula | Better domain alignment; requires scientific evidence and expanded fixtures. |
| Fixed 0–100 component and overall range | Familiar public presentation; requires explicit handling for no-data and uncertainty. |
| Hazard-specific component scales normalized into an overall range | More flexible; higher explainability and calibration burden. |
| Keep missing components out of the blend | Avoids fabricated values; denominator and comparability must be explicit. |
| Block overall score when required components are missing | Stronger integrity; may increase no-data results. |

**Acceptance criteria:** a versioned fixture suite reproduces unrounded inputs, components, overall result, rounding, caps/floors, and ties byte-for-byte for a fixed manifest and `as_of` time.

## 5. Source resolution, confidence, freshness, and no-data decision

### Source precedence and conflicts

Approve a source-priority matrix per `(hazard, jurisdiction, feature kind)`. Deduplicate only through approved canonical feature mappings; provider IDs and aliases alone are not sufficient. Retain conflicts, rank them by approved source priority, temporal validity, resolution, quality tier, and deterministic canonical-ID tie-break. An unresolved equal-rank conflict becomes `unknown`, not an arbitrary winner.

### Confidence and freshness

Confidence must be deterministic and use only approved coverage, source tier, validation result, resolution, temporal validity, and freshness inputs. It must not be generated by AI. Approvers must set minimum public-score quality/confidence thresholds and source-specific freshness/maximum-staleness limits. Stale data can be used only if the approved formula permits it and reduces confidence by a defined versioned rule.

### Closed no-data states

| State | Required calculation behavior |
| --- | --- |
| `available` | Eligible only when quality gate and coverage pass. |
| `not_applicable` | Exclude under declared formula; never convert to zero. |
| `out_of_coverage` | Do not calculate or blend. |
| `unknown` | Block the component/public score. |
| `unavailable` | Omit, or use declared last-known-good only when also marked `stale`. |
| `stale` | Use only under approved formula and deterministic confidence reduction. |
| `expired` | Do not calculate or blend. |
| `suppressed` | Do not calculate, blend, display, or export. |

No no-data state may be represented as low risk, safe, zero, green, complete coverage, or a favorable default.

**Acceptance criteria:** source-priority/conflict fixtures are deterministic; confidence/freshness boundaries are testable; every no-data state is visible and cannot enter a prohibited calculation path.

## 6. Historical evidence, exposure, uncertainty, and public language

- Historical events may support only an approved recurrence/evidence component with stated period, coverage, completeness, and uncertainty. They cannot imply a current event, forecast, or official warning.
- Exposure features may describe accepted geographic proximity/condition only. They cannot imply likelihood, recurrence, movement, safety, or official status without authoritative evidence and an approved formula.
- `active_fault` remains unavailable/out_of_coverage until the merged Approval 2 source-authorization and validation gate is complete. A missing fault source is not low risk, inactive, safe, or an earthquake-probability assessment.
- Every score, component, overlay, and AI explanation must expose uncertainty, coverage, freshness, provenance, and “screening information, not an official advisory” wording where the public-display policy requires it.
- AI cannot turn uncertainty, absent evidence, historical evidence, or overlay data into a certainty, score, probability, or safety conclusion.

**Acceptance criteria:** regression prompts and UI/export fixtures reject or template unsupported safety/probability/advisory claims; historical and exposure examples preserve their declared semantics.

## 7. Versioning, manifests, and shared snapshot decision

Every score is a pure function of one immutable, canonically ordered manifest. A snapshot must retain or reference:

- opaque server-issued `snapshot_id`, authorization scope, canonical location/grid/query, `as_of` in UTC, requested coverage parameters, and timezone policy;
- taxonomy, score-engine/configuration, transform, grid, and API contract versions; producing application build/commit identifier;
- accepted dataset/version/artifact hashes, feature IDs, source citations, coverage/no-data states, quality/confidence inputs, formulas/weights, unrounded outputs, rounded outputs, and deterministic explanations;
- manifest hash, cache-key inputs, expiration/freshness state, and supersession relationship.

Map, Dashboard, Export, and AI must consume the same authorized immutable snapshot for one assessment. Snapshot IDs are opaque references, not authorization credentials. Client-provided context cannot create, modify, select, or authorize a snapshot. A freshness or engine-input change creates a new snapshot; it never mutates an existing one.

**Acceptance criteria:** integration fixtures show identical snapshot ID/components across Map, Dashboard, Export, and AI; altered client context cannot change the server result; later data/version changes still reproduce a retained manifest.

## 8. Owners, evidence, deadline, and non-approval effect

| Role | Required approval responsibility |
| --- | --- |
| Risk-scoring product owner — owner | Product meaning, score range, public language, and decision record. |
| Hazard-science lead | Formula, weights, thresholds, historical/exposure semantics, uncertainty, and overlay policy. |
| Data governance lead | Source priority, quality/confidence thresholds, provenance, coverage, and freshness policy. |
| Geospatial engineering lead | Grid, geometry, spatial-input semantics, reproducibility, and regression fixtures. |
| Backend/platform lead | Immutable manifest, snapshot authorization, cache/concurrency, and versioning constraints. |
| Security/privacy lead | Authorization boundaries and client-context prohibition. |
| AI platform owner | Explanation-only enforcement, citation/component validation, and fallback behavior. |

### Required evidence

- A signed formula/weight/range/source-priority/confidence matrix with named scientific and data-governance rationale.
- Fixed source fixtures and expected manifests, unrounded/rounded components, overall scores, ties, overlays, stale/no-data cases, and legacy mappings.
- Shadow comparison against the current engine with approved difference thresholds and user-facing explanation.
- Evidence that every candidate source meets the approved coverage, licensing, provenance, freshness, and quality gate.
- Map/Dashboard/Export/AI consistency, authorization, client-tampering, AI grounding, accessibility, performance, rollback, and audit test plan.

### Approval acceptance criteria

- Every calculation rule and public score meaning is versioned, evidence-backed, and reproducible.
- No unapproved source, overlay, stale/no-data state, client context, or AI output can alter a score.
- `active_fault` remains unavailable/out_of_coverage until Approval 2’s source gate is complete.
- A shared authorized immutable snapshot is the sole score context across product surfaces.
- The decision links its evidence in Issue #9 before an implementation ticket begins.

### Deadline and effect of non-approval

- **Proposed deadline:** before any scoring-engine, snapshot, Map/Dashboard/Export integration, or AI-grounding implementation ticket.
- If unapproved, no deterministic scoring, source-priority, formula, snapshot, overlay, or user-visible risk-score implementation may begin. Documentation and non-production research may continue only.

## 9. Explicit Approval 3 checklist

1. Approve the canonical taxonomy, record classes, and legacy compatibility mapping.
2. Approve which accepted evidence may affect baseline scores and require active events/alerts to remain overlays unless separately versioned and approved.
3. Approve the canonical formula package: component/overall range, weights, blend, caps/floors, rounding, missing-component behavior, and deterministic tie-breaking.
4. Approve the source-precedence, deduplication, conflict-resolution, quality, confidence, freshness, and closed no-data policy.
5. Approve historical-event, exposure, uncertainty, `active_fault`, and public-language boundaries, including all no-safety/probability/advisory prohibitions.
6. Approve immutable manifest and server-authorized snapshot requirements across Map, Dashboard, Export, and AI; affirm AI explanation-only and client context non-authoritative rules.
7. Approve named owners, required evidence, acceptance criteria, and deadline as gates before implementation.

**Final status:** Proposed / Pending Approval. This Approval 3 decision, Approvals 4–5, and source-specific evidence remain blocking requirements. No Sprint 1 implementation is authorized.
