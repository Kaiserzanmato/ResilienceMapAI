# Sprint 1: Deterministic multi-hazard scoring and dataset synchronization

## Decision summary

Replace the current mix of curated in-process zones, country baselines, and
event cache with a versioned deterministic read model. The existing source
registry remains the allowlist and the existing sync-health/audit mechanisms
are extended rather than replaced. AI remains a consumer of a persisted score
snapshot; it never calculates, alters, or fills in a score.

This is a planning specification. It does not authorize an ingestion source,
schema migration, scoring change, or production configuration change.

## Current-state findings

- `risk_scoring.score_location` produces deterministic scores from
  `sample_hazards.py`, but its output is generated independently by Map,
  Dashboard-related services, and AI endpoints rather than from a shared
  persisted snapshot.
- The source registry, `sync_health`, and `sync_audit_log` already capture
  allowlisting and basic success/failure state. Only four source connectors
  are currently wired; retries, content-versioning, and per-record
  provenance are not yet first-class.
- `event_intelligence` has normalized current events and validation but is
  intentionally isolated from deterministic scoring.
- PHIVOLCS is present in the registry as a manual-grounding portal. No
  authoritative fault-line geometry is currently ingested or spatially
  queried.
- AI insight generation receives a deterministic result but still builds its
  grounding from source labels, not immutable snapshot provenance.

## 1. Canonical hazard data model

### Fixed hazard vocabulary

Use stable machine keys throughout source data, scoring, snapshots, APIs, and
UI adapters:

`earthquake`, `flood`, `tropical_cyclone`, `landslide`, `active_fault`,
`storm_surge`, and `historical_event`.

`historical_event` is evidence of observed impact/recurrence, not a live
hazard warning. It must never be treated as a current alert without a separate
time-windowed live-source signal.

### Persisted entities

| Entity | Purpose | Deterministic identity |
| --- | --- | --- |
| `dataset_version` | Immutable accepted source retrieval/transform version. | `source_id + upstream_version_or_content_hash` |
| `hazard_feature` | Normalized source geometry, attributes, validity period, and provenance link. | `dataset_version_id + provider_feature_id` |
| `hazard_feature_coverage` | Optional precomputed geographic coverage and resolution metadata. | `hazard_feature_id + coverage_type` |
| `location_risk_snapshot` | Immutable score result for a normalized coordinate, engine version, and input manifest. | coordinate grid + `score_version` + input-manifest hash |
| `location_risk_component` | Per-hazard score, inputs, contribution rule, confidence, and no-data reason. | `snapshot_id + hazard_key` |
| `sync_run` / `sync_attempt` | Idempotency, retry, outcome, and telemetry records. | source + scheduled window / idempotency key |

Geometries are stored in WGS84 with PostGIS. Source features retain the
original provider identifier and normalized geometry separately. Scoring reads
only accepted dataset versions, never a partially transformed batch.

## 2. Dataset provenance contract

Every `dataset_version`, feature, component, and snapshot must expose or
reference these fields:

| Field | Meaning |
| --- | --- |
| `source` | Registry source ID, provider organization, and canonical source URL. |
| `license` | License/terms identifier plus attribution requirement; `unknown` blocks production scoring. |
| `collected_at` | Upstream observation/publication time when supplied. |
| `refreshed_at` | Time ResilienceMap retrieved the source. |
| `transformed_at` | Time the normalized version was accepted. |
| `confidence` | Controlled category and numeric policy tier, never an AI-generated label. |
| `staleness` | Computed state (`fresh`, `aging`, `stale`, `expired`, `unknown`) from source SLA. |
| `geographic_coverage` | Country/region/bounds plus resolution and geometry type. |
| `score_version` | Immutable engine/rule/input-manifest version used by a snapshot. |

Persist content hashes and transformation-schema versions. Do not overwrite a
successful dataset version; mark it superseded only after a later accepted
version exists. Redact credentials, headers, and source-query tokens from all
provenance, telemetry, and exports.

## 3. Idempotent synchronization design

1. Scheduler creates a `sync_run` with a deterministic idempotency key:
   `source_id:scheduled_window:connector_version`.
2. A database uniqueness constraint allows one active/accepted run for that
   key. A duplicate trigger returns the existing run instead of fetching again.
3. Connector fetches only allowlisted hosts, validates schema/geometry/size,
   writes a staged dataset version, and hashes canonicalized content.
4. Transformation is transactional: validate -> normalize -> quality gate ->
   atomically mark accepted -> enqueue snapshot invalidation. On failure, keep
   the last accepted version readable.
5. Retry only transient failures with bounded exponential backoff and jitter.
   Record attempt number, HTTP/status class, duration, retryability, and a
   sanitized error code; never persist provider credentials or raw payloads.
6. Publish source freshness from accepted-version timestamps and registry SLA,
   not from a UI refresh click. Surface `fresh`, `stale`, and `last-known-good`.

Use a durable queue/worker and database lease for production execution. Do not
depend on an in-process loop or Vercel request lifetime for scheduled work.

## 4. Reproducible location snapshots

`POST /api/assessments` becomes the one scoring entry point. It normalizes the
coordinate to an explicitly documented grid, resolves an input manifest of
accepted dataset versions, and returns a `snapshot_id`, `score_version`,
components, provenance references, and freshness status.

- **Map** reads the returned snapshot; hazard layers reference the same score
  version/input manifest.
- **Dashboard** aggregates snapshots by explicit version and does not recompute
  from a separate sample dataset.
- **AI Research Agent** receives only `snapshot_id` and server-rendered,
  immutable component/provenance context. The backend rejects client-supplied
  scores for a grounded answer.
- Snapshot cache keys include normalized location, requested geometry type,
  score version, and input-manifest hash. Invalidate by manifest/version, not
  by broad cache flush.

The initial engine should preserve the documented max-weighted contribution
and overall blend only after each input rule is versioned and test-fixtured.
No silent score changes are allowed when a source changes.

## 5. PHIVOLCS active-fault ingestion and spatial query

1. Obtain an official PHIVOLCS or PHIVOLCS/GeoRiskPH machine-readable fault
   geometry distribution and confirm its license, update cadence, coverage,
   and permitted use before enabling it. Do not scrape a portal page.
2. Register it as a country-scoped `PH` source with manual approval until the
   connector and terms are validated.
3. Normalize official feature IDs, fault name/status, geometry, publication
   date, and metadata into an accepted `dataset_version`; preserve the source
   artifact checksum and attribution.
4. Store fault lines as `geometry(LineString|MultiLineString, 4326)` with a
   GiST index. For a selected location, use `ST_DWithin` on geography for a
   documented distance band, `ST_Distance` for nearest distance, and an
   engine-versioned distance-to-score curve. Do not infer rupture probability
   or issue official fault advisories.
5. Return nearest-fault distance, source/version, coverage, and `no_data`
   where geometry is unavailable; display this separately from earthquake
   event activity.

## 6. Grounded-summary boundary

The score service produces an immutable `GroundedRiskContext` containing only
snapshot components, provenance citations, freshness, confidence, and
approved uncertainty text. The AI prompt may explain those facts and propose
clearly labeled preparedness actions. It must not invent or modify hazard
scores, sources, source dates, data coverage, certainty, or official warnings.

Enforce this at three layers:

- response schema references component/snapshot IDs rather than free-text
  numeric claims;
- deterministic post-validation rejects score/source/certainty statements not
  present in the context;
- fallback summaries are templates rendered from the same snapshot.

## 7. Test plan

| Layer | Required coverage |
| --- | --- |
| Unit | Hazard-key vocabulary, provenance validation, staleness boundaries, canonical hashing, score rules, no-data states, PHIVOLCS distance bands, and AI output validation. |
| Integration | Postgres/PostGIS migrations, source staging/acceptance transaction, idempotency uniqueness, retries, last-known-good preservation, snapshot reuse/invalidation, and API contracts. |
| Regression | Fixed source fixtures produce byte-stable manifests and score snapshots; Map/Dashboard/AI receive the same snapshot ID/components; older score versions remain retrievable. |
| Security | SSRF/allowlist connector tests, payload/geometry bounds, malicious source metadata, authorization for manual sync, telemetry redaction, and prompts attempting to override deterministic context. |
| Performance | Benchmark representative location assessment, nearest-fault query, batch snapshot refresh, and UI payload size against agreed p95 budgets. |

## 8. Performance, rollout, and rollback

### Performance controls

- GiST indexes for source and fault geometry; bounded geographic queries.
- Versioned snapshot cache with targeted invalidation and response ETags.
- Asynchronous batch recomputation with back-pressure; serve the last accepted
  snapshot with explicit freshness while recomputation is pending.
- Avoid loading raw source geometry into Map/Dashboard/AI responses; publish
  simplified, bounded GeoJSON views by zoom/coverage.

### Rollout

1. Ship schema and read paths behind a disabled feature flag; backfill only
   curated fixtures in a non-production environment.
2. Shadow-score selected locations against the current engine and review
   differences by score version and source manifest.
3. Enable one hazard/source at a time, beginning with earthquake events and
   PHIVOLCS active-fault data only after formal source approval.
4. Enable snapshot-backed Map, then Dashboard, then AI context after parity
   checks and observability are green.

### Rollback

Disable the snapshot read feature flag and return to the last supported
read-only curated-score version. Do not delete accepted datasets or snapshots.
Pause the affected source worker, retain last-known-good data with a stale
marker, and record the failed source/version/run for remediation.

## Acceptance criteria for implementation approval

- Every displayed hazard component has a score version and provenance record.
- Repeating an assessment against the same input manifest returns the same
  snapshot components and score.
- Sync retries are idempotent and a failed run cannot replace accepted data.
- Map, Dashboard, and AI share one snapshot ID for a location assessment.
- PHIVOLCS fault results are sourced, distance-based, indexed, and clearly
  distinguished from earthquake activity.
- AI output is rejected or templated when it claims unsupported score/source/
  certainty data.
