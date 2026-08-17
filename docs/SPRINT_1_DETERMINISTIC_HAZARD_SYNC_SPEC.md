# Sprint 1: Deterministic multi-hazard scoring and dataset synchronization

## Decision summary

Replace the current mix of curated in-process zones, country baselines, and
event cache with an additive, versioned deterministic read model. The existing
source registry remains the source allowlist; existing sync-health and audit
mechanisms are extended rather than replaced. AI is a consumer of a persisted
score snapshot and never calculates, changes, or fills in a score.

This is a planning specification. It does not authorize an ingestion source,
database migration, scoring change, production configuration change, or
deployment. Implementation must remain feature-flagged and preserve the
current read path until the acceptance criteria below are met.

## Current-state findings and compatibility boundary

- `risk_scoring.score_location` currently scores curated `sample_hazards.py`
  zones and country baselines at request time. Map, Dashboard services, and AI
  endpoints can independently produce or package that transient context.
- The source registry, `sync_health`, and `sync_audit_log` provide allowlisting
  and basic outcome state. Current connectors do not yet provide durable
  idempotency, content versioning, or record-level provenance.
- `event_intelligence` normalizes current events but is intentionally isolated
  from deterministic baseline scoring.
- PHIVOLCS is registered as a manual-grounding portal. No approved fault-line
  artifact is currently ingested or spatially queried.
- Existing vocabulary is `earthquake`, `flood`, `tropical_cyclone`, `volcano`,
  `landslide`, and `storm_surge`. Sprint 1 introduces `active_fault` and
  `historical_event`; it does not silently remove or reinterpret `volcano`.

### Current-vocabulary compatibility mapping

| Existing key | Sprint 1 disposition |
| --- | --- |
| `earthquake`, `flood`, `tropical_cyclone`, `landslide`, `storm_surge` | Same canonical key; retain existing adapter during dual-read. |
| `volcano` | Remains supported as a legacy/non-Sprint-1 hazard adapter. It must be explicitly no-data in a Sprint 1-only response, never silently dropped. |
| `active_fault` | New exposure-feature component; not an earthquake event or warning. |
| `historical_event` | New evidence/recurrence component; never a live alert without a separately accepted live signal. |

## 1. Canonical taxonomy and no-data contract

### Taxonomy

Every normalized record has exactly one `record_class`, a canonical hazard key,
and a versioned taxonomy identifier. A source feature may support more than one
hazard only through explicit, separately versioned component mappings.

| Record class | Meaning | Score role |
| --- | --- | --- |
| **Hazard phenomenon** | A potentially harmful natural process, such as flood or tropical cyclone. | Input category; not itself a score record. |
| **Exposure feature** | A geographic condition affecting exposure, such as an active-fault line. | Spatial input only; cannot claim event likelihood. |
| **Active event** | Time-bounded observed occurrence from an accepted provider. | May drive a separately labeled current-event overlay. |
| **Alert** | An authoritative time-bounded advisory or warning. | May drive an overlay only when issuer, validity, and jurisdiction are accepted. |
| **Historical event** | Past observed impact or recurrence evidence. | Baseline evidence only; never a current warning. |
| **Derived score component** | Versioned deterministic calculation from accepted inputs. | The only score-bearing record. |

Canonical hazard IDs are `hazard:{taxonomy_version}:{hazard_key}`. Features
have an immutable internal ID, `source_id`, `provider_feature_id`, provider
aliases, `feature_kind`, and source dataset version. Provider IDs are unique
only within `(source_id, dataset_version_id)`; aliases are never used as a
deduplication key without an approved mapping.

### Formal no-data states

No-data is not a numeric zero. Each component and snapshot coverage entry uses
one of these states plus a safe reason code:

| State | API meaning | UI meaning | Scoring behavior |
| --- | --- | --- | --- |
| `available` | Accepted inputs cover the query. | Show value and provenance. | Calculate normally. |
| `not_applicable` | Hazard cannot apply to the requested geography/context. | “Not applicable.” | Exclude from blend; never score zero. |
| `out_of_coverage` | Source does not cover the query geography/resolution. | “Not covered by this source.” | Exclude and disclose coverage gap. |
| `unknown` | Coverage or input quality cannot be determined. | “Data status unknown.” | Block production component calculation. |
| `unavailable` | Expected source is temporarily unavailable. | “Temporarily unavailable; last update …” | Use only declared last-known-good data, marked stale, or omit. |
| `stale` | Accepted data exceeds its source SLA but is retained. | “Stale as of …” | Use only if the component policy permits; lower confidence deterministically. |
| `expired` | Data exceeds its maximum retention/validity age. | “Expired; not used.” | Do not use. |
| `suppressed` | Data cannot be displayed or used due to license, privacy, or safety policy. | “Unavailable for this view.” | Do not use. |

**Acceptance criteria:** API fixtures prove every state is distinguishable,
never serialized as `0` or “low risk”; UI contract tests show the stated label;
`unknown`, `expired`, and `suppressed` cannot enter a production score.

## 2. Deterministic scoring contract

### Input resolution and calculation

The scoring engine is a pure, versioned function over one immutable input
manifest. A `score_engine_version` names source-priority policy, mappings,
weights, confidence calibration, formulas, thresholds, rounding, and
no-data behavior. Configuration is content-hashed and retained with each
snapshot.

1. Normalize coordinates to WGS84 longitude/latitude, reject non-finite or
   out-of-range coordinates, then quantize with a documented grid precision.
   Store both original request coordinates (access-controlled) and canonical
   grid coordinates. The grid algorithm/version is an input to the manifest.
2. Resolve accepted datasets under the source-priority table for the requested
   jurisdiction, geometry, and `as_of` instant. `as_of` is RFC 3339 UTC;
   source-local dates retain their IANA timezone and conversion rule.
3. Deduplicate only by approved source/canonical-feature mapping. Conflicting
   observations are retained, ranked by source priority, temporal validity,
   geographic resolution, and quality tier; unresolved equal-rank conflicts
   yield `unknown`, not arbitrary selection.
4. Apply published, versioned per-hazard formulas, bounded input ranges,
   confidence calibration, and weights. Confidence must be computed solely
   from defined coverage, freshness, source tier, and validation criteria.
5. Round component and overall scores only at defined output boundaries using
   named decimal mode. Resolve equal rankings by stable canonical ID order.
   Store unrounded values and contribution explanation for reproduction.

The overall blend, including the current max/mean behavior if retained, must
be a declared formula with component inclusion/exclusion rules. A missing
component cannot silently change denominator, weight, or score meaning.

### Baseline and current-event overlays

Baseline score inputs are accepted durable features and historical evidence
valid at `as_of`. Active events and alerts produce a separately versioned
overlay with event/alert IDs, issuer, validity window, and expiry. Overlays
may be displayed alongside a baseline score but cannot mutate its value or be
represented as a baseline component unless a later approved engine version
explicitly defines that rule. Expired/retracted overlays are removed by their
temporal-validity contract while retained for audit.

**Acceptance criteria:** fixed fixtures produce byte-stable manifests,
unrounded components, rounded outputs, and tie outcomes; the same inputs and
`as_of` always reproduce the snapshot; current-event fixtures change only the
overlay unless an explicitly versioned engine rule says otherwise.

## 3. Versioned data, geometry, temporal validity, and provenance

### Dataset and feature contract

`dataset_version` is immutable and contains: source registry ID, provider,
canonical source URL, upstream revision/version if supplied, retrieval request
class (never credentials or query tokens), artifact hash and hash algorithm,
canonicalization/transform schema version, artifact size, acceptance time,
and supersession relationship. Raw artifacts follow a documented access,
retention, and redaction policy.

Each `hazard_feature` references one accepted dataset version and contains its
canonical ID, provider ID, aliases, `record_class`, `feature_kind`, taxonomy
version, source attributes needed by a declared formula, and a provenance
pointer. Record-level provenance includes license identifier/terms URL,
attribution text, license-review status and reviewer/date, permitted-use
restriction, source revision, confidence tier, geographic coverage, and data
quality flags. A license status of `unknown`, rejected, expired, or
incompatible blocks production scoring and public export.

### Geometry and temporal rules

- Normalize incoming geometries to EPSG:4326. Preserve declared source CRS and
  transformation version; reject unrecognized CRS rather than guessing.
- Support only approved GeoJSON/PostGIS geometry types per `feature_kind`.
  Validate SRID, bounds, ring closure, self-intersection, dimensionality, and
  antimeridian handling. Any repair must be deterministic, recorded, and
  approval-gated; otherwise reject the record.
- Store source geometry and normalized geometry separately. Define precision,
  simplification, Z/M handling, bounding-box use, and point/line/polygon
  distance/intersection semantics in the engine config.
- Store `observed_at`, `published_at`, `effective_from`, `effective_to`,
  `retrieved_at`, `accepted_at`, `retracted_at`, and `superseded_by` when
  applicable. Open-ended validity is explicit, not null-by-convention.

### Immutable reproducibility manifest

Every snapshot stores a canonically ordered, hashed manifest containing:

- snapshot ID, canonical grid/query geometry, `as_of`, timezone policy, and
  requested component/coverage parameters;
- each accepted dataset/version/artifact hash, feature IDs, coverage and
  no-data states used or excluded;
- taxonomy, score-engine, configuration, transform, grid, and API contract
  versions, plus producing application build/commit identifier;
- unrounded component inputs/outputs, formula/weight IDs, confidence result,
  source citations, and human-readable deterministic explanation.

**Acceptance criteria:** a record’s provenance and geometry can be validated
without raw credentials; invalid CRS/geometry and unapproved license fixtures
are rejected; a retained manifest reproduces the same result after later data
versions are accepted.

## 4. Durable synchronization design

### State, idempotency, and ownership

`sync_run` transitions only through `queued -> leased -> fetching -> staging
-> validating -> accepted | no_change | retry_wait | failed | cancelled |
expired`. Transitions are append-audited with actor/trigger, timestamps, safe
error class, and attempt ID. A run cannot return to a prior state.

The idempotency key includes `source_id`, connector version/config hash,
trigger type, requested time range/window, and canonical requested artifact
identity when known. It must not treat a manual correction or a changed source
artifact as the same run merely because the scheduled window matches. Database
unique constraints and transactional state checks enforce one active owner.

Workers acquire a database lease with owner ID, heartbeat, lease expiry, and
fencing token. Expired leases are recovered by a new worker only after a
transactional ownership check. Queue delivery is at-least-once; all writes are
therefore idempotent. An outbox record is committed with accepted data, then a
reliable relay dispatches cache invalidation/recomputation without coupling it
to request lifetime.

### Retry, validation, and recovery

- Retry only classified transient failures with bounded exponential backoff,
  full jitter, maximum attempts/age, and honored `Retry-After`. Authentication,
  schema, license, and geometry validation failures are non-retryable until a
  corrective configuration or source version exists.
- Source-specific circuit breakers stop repeated fetches after defined failure
  thresholds; operators receive sanitized telemetry. Exhausted jobs enter a
  durable dead-letter queue with a replay approval trail.
- Fetch into staging. Validate source allowlist, payload/geometry bounds,
  checksum, schema, license, quality, and coverage before a single database
  transaction promotes a complete dataset version to `accepted` and writes its
  outbox event. Partial batches never become accepted; policy is all-or-nothing
  per declared source artifact, with resumable staging only when chunk identity
  and completeness checks are defined.
- Retain last-known-good accepted versions through source-specific maximum
  retention. Mark them stale, never fresh. Rollback selects the prior accepted
  version by ID and records why; it does not delete failed or accepted history.

**Acceptance criteria:** concurrent duplicate triggers create one effective
accepted version; forced lease loss, repeated delivery, partial input, retry,
circuit-breaker, and dead-letter tests preserve last-known-good data and emit
one auditable outcome without sensitive values.

## 5. PHIVOLCS active-fault data acceptance and spatial queries

PHIVOLCS ingestion is disabled until a data steward approves a machine-readable
official PHIVOLCS or PHIVOLCS/GeoRiskPH distribution. Approval records the
exact endpoint/distribution identifier, publisher, license/terms, attribution,
allowed use, update cadence/SLA, PH geographic coverage, artifact format,
validation owner, and review/renewal date. Portal scraping is prohibited.

The connector validates checksum, schema, CRS, publisher provenance, and
geometry before staging. Normalize approved `LineString`/`MultiLineString`
fault geometry, canonical/provider IDs, names/statuses, publication/validity
dates, and source metadata. Invalid topology, unknown CRS, or unsupported
geometry is rejected and cannot replace last-known-good data.

Store normalized fault geometry in EPSG:4326 with a GiST index. Queries use a
geography `ST_DWithin` prefilter with an approved maximum band, then
`ST_Distance` for the spheroidal nearest distance; KNN/index use must be
verified with explain plans and regional fixtures. The engine records query
SRID, distance method, threshold, nearest feature/version, and any coverage
gap. Distance-to-score curve, bands, and uncertainty must have named scientific
owner approval and engine version before release.

The system must never infer rupture probability, fault movement, earthquake
probability, or issue official advisories from distance or geometry.

**Acceptance criteria:** acceptance cannot be enabled without a completed
source-approval record; PH fixtures prove indexing, distance thresholds,
boundary/invalid-geometry handling, and attribution; outputs state exposure
distance only and contain no inferred probability or advisory.

## 6. Shared, server-authorized snapshot contract

`POST /api/assessments` is the only score creation/resolution entry point. It
returns an opaque, immutable, server-issued `snapshot_id`, manifest hash,
engine version, freshness/no-data status, components, and permitted provenance
references. Snapshot IDs are unguessable, access-controlled, and bound to the
requesting authorization scope, canonical query, and retention policy.

Snapshot reads use `GET /api/assessments/{snapshot_id}` (or an equivalent
versioned server endpoint); clients cannot submit a snapshot ID as proof of
authority. Creation coalesces identical in-flight requests via transactional
unique manifest identity/lock, prevents cache stampedes, and returns the same
immutable snapshot or a defined pending status. Cache keys include canonical
query, `as_of`, requested geometry/coverage options, authorization-safe scope,
engine/config version, and manifest hash. Freshness changes create a new
snapshot, never mutate an existing one.

Map, Dashboard, exports, and AI receive and display the same snapshot ID and
component versions for one assessment. Client-provided scores, hazard arrays,
map context, timestamps, or provenance are presentation hints only and are
never authoritative input to a grounded answer, export, or score.

**Acceptance criteria:** integration tests show a single snapshot ID and
components across Map/Dashboard/export/AI; altered client context cannot alter
the server result; concurrent requests do not create divergent snapshots; a
stale snapshot remains immutable and is visibly labeled.

## 7. AI security and grounding contract

All user prompts, client map context, uploaded/remote source content, source
metadata, and provider responses are untrusted content. They are never allowed
to supply system instructions, score values, source authority, authorization
decisions, or model/tool selection. Only the server renders an allowlisted,
size-bounded `GroundedRiskContext` from an authorized immutable snapshot.

AI must return a schema-validated structured response containing component IDs,
snapshot ID, approved citation IDs, explicitly labeled uncertainty, and
preparedness content. The server validates every component/citation/value
against the snapshot manifest before rendering. Free-text claims that cannot
be mapped to approved component/citation IDs are rejected. Failure, timeout,
or invalid output returns a deterministic template rendered from the same
snapshot; it does not retry by expanding context or inventing a summary.

Authorization must define user/service roles for assessment reads, provenance
detail, exports, manual sync/replay, and administrative audit access. Store
only a minimum necessary precise location; enforce access scope, retention,
deletion policy, and redacted audit logs. Rate limits and abuse controls apply
per authenticated principal and trusted network policy, with quotas independent
of model claims. Model/provider choice is server allowlisted, versioned,
cost-capped, logged without prompts/secrets beyond approved retention, and
cannot be selected by the client.

**Acceptance criteria:** prompt-injection fixtures from users, source metadata,
and map context cannot change deterministic facts or tools; unsupported
citations/components are rejected; unauthorized snapshot/provenance/sync access
is denied; fallback output is deterministic and cited to the same snapshot.

## 8. Delivery, operations, and test matrix

### Migration and rollout

Before implementation, publish forward/backward-compatible migration steps,
schema ownership, index build approach, backfill source/volume, and rollback
limits. Roll out with disabled server feature flags, dual-write only where
transactionally safe, and explicit dual-read comparison telemetry. Do not use
new snapshots as the visible source of truth until parity thresholds are met.
Existing clients remain compatible through a versioned adapter; legacy reads
remain until an approved retirement date.

Enable one approved hazard/source at a time. Rollback triggers include data
quality/coverage breach, score-parity breach, sync-failure or freshness SLO
breach, query latency breach, security failure, or cost-budget breach. Rollback
disables the read flag, pauses the affected source, serves the prior supported
read path or explicitly stale last-known-good snapshot, and preserves all
accepted/audit history for investigation.

### SLOs, retention, observability, performance, and cost

Implementation approval must set numeric per-source freshness SLOs, score API
p95/p99 latency and error budgets, sync completion/error/lease-recovery SLOs,
queue-depth limits, geographic-query limits, storage/retention durations,
backup/restore RPO/RTO, and monthly ceilings for source APIs, queue, database,
geometry storage, cache, and AI use. There is no default production threshold.

Emit redacted structured telemetry for sync state/lag/retry/dead-letter,
accepted dataset/version, validation/license rejection, coverage/no-data,
snapshot manifest/version/divergence, cache effectiveness, PostGIS query plan
health, API latency/error, feature flag state, and AI grounding validation.
Alerting must identify source and version without exposing payloads, query
tokens, prompts, or secrets.

### Required test matrix

| Area | Required evidence |
| --- | --- |
| Unit/property | Taxonomy, canonical hashes, coordinate/rounding/ties, confidence, no-data, staleness, temporal validity, and deterministic score rules. |
| Database/migration | Forward/backward migration rehearsal, backfill, index build, dual-read/write compatibility, and restore/rollback verification. |
| Sync/concurrency | Duplicate delivery, leases/heartbeat/expiry takeover, races, retries/`Retry-After`, circuit breakers, dead letters, partial staging, outbox replay, and last-known-good rollback. |
| Spatial | PostGIS fixtures for PH fault lines, CRS/antimeridian/invalid geometry, coverage boundaries, distance bands, GiST query plans, and simplification precision. |
| Data governance | Source allowlist/SSRF, artifact bounds, licensing/attribution gate, provenance completeness, retention, and redacted telemetry. |
| API/product | Snapshot consistency across Map/Dashboard/export/AI, stale/no-data UX, client-context tampering, and legacy adapter behavior. |
| Security/AI | Authentication/authorization, sensitive-location access, prompt injection, malicious source metadata, citation/component validation, abuse/rate limits, and deterministic fallback. |
| Performance/resilience | Representative load/soak, batch recomputation, cache-stampede, queue/database/API cost budgets, source outage, disaster recovery, and feature-flag rollback drills. |

**Acceptance criteria:** implementation cannot progress beyond shadow mode until
numeric SLO/budget values, named owners, alert runbooks, migration rehearsal,
and the required automated/manual evidence are approved; all rollout and
rollback drills complete without data deletion or secrets in telemetry.

## Implementation-approval gate

Engineering may begin only after the following are approved and testable:

1. taxonomy, no-data semantics, scoring policy, and vocabulary migration;
2. schema/provenance/geometry/temporal contracts and immutable manifest;
3. source-by-source acceptance record, beginning with PHIVOLCS fault data;
4. sync state machine, lease/outbox/recovery model, and last-known-good policy;
5. snapshot authorization and Map/Dashboard/export/AI consistency contract;
6. AI grounding, authorization, privacy, audit, abuse, and model policies;
7. numeric SLOs, cost/retention budgets, migration plan, feature flags, and
   rollout/rollback runbooks; and
8. the complete test matrix and named evidence owners.
