# Sprint 1 implementation approvals

## Purpose

This document turns the five Conditional-GO blockers from the deterministic
hazard-sync blueprint into decisions that must be recorded before engineering
begins. It is an approval brief only. It does not authorize code, migrations,
source enablement, data collection, configuration changes, or deployment.

Each record is **Pending** until its named approver records an **Approved**
decision with the required evidence. An approved decision becomes a versioned
input to the implementation plan; a later change requires a new decision
record and compatibility/rollback review.

## Decision record 1 — Deterministic scoring policy

**Status:** Pending

### Decision required

Approve the canonical scoring formulas, per-hazard weights, overall blend,
source-precedence order, deduplication/conflict rules, confidence calibration,
rounding/tie-breaking policy, and current-event overlay policy. The decision
must state whether the existing max/mean blend is retained, changed, or used
only as a comparison baseline.

### Owner and approvers

- Owner: Risk-scoring product owner.
- Approvers: designated hazard-science lead, data engineering lead, and product
  manager.

### Recommended default

Start with a versioned, documented baseline formula that preserves the current
engine only as a parity comparator. Use an explicit ordered source-precedence
table by hazard and jurisdiction; retain conflicts unless one source clearly
wins under the approved rule. Keep active events and authoritative alerts as a
separate, expiring overlay that does not change the baseline score.

### Options and trade-offs

| Option | Trade-off |
| --- | --- |
| Preserve current blend initially | Lowest migration risk and easiest parity testing; may retain known calibration limitations. |
| Adopt new expert-approved formulas immediately | Better domain alignment; needs more fixture work, scientific review, and careful user communication. |
| Single highest-priority source per hazard | Simple and predictable; can discard complementary coverage. |
| Weighted multi-source fusion | Can improve coverage; adds calibration, explainability, and conflict-resolution complexity. |
| Event/alert overlay only | Keeps baseline stable and reproducible; requires clear UI separation. |
| Event/alert changes baseline | Can be more responsive; makes historical reproduction and score meaning harder. |

### Evidence required

- Hazard-science rationale for every formula, threshold, weight, and distance
  curve.
- Source priority and conflict matrix for each hazard/jurisdiction.
- Fixed fixtures with expected unrounded and rounded component/overall scores.
- Shadow comparison against the current engine and documented acceptable
  differences.
- Product copy explaining baseline, confidence, and overlay semantics.

### Acceptance criteria

- A versioned scoring policy can reproduce the same result from the same
  immutable manifest and `as_of` instant.
- Every score component identifies its formula, sources, weight, confidence,
  and no-data behavior.
- Equal-rank conflicts produce the approved deterministic result or `unknown`.
- Current-event fixtures affect only the approved overlay behavior.

### Deadline and effect if unapproved

- Decision deadline: before any scoring-engine, API, or snapshot implementation
  ticket starts.
- If unapproved: engineering may build no scoring logic, source-priority table,
  or user-visible overlay; Sprint 1 remains in planning.

## Decision record 2 — PHIVOLCS / GeoRiskPH fault-data approval

**Status:** Pending

### Decision required

Approve one machine-readable official PHIVOLCS or PHIVOLCS/GeoRiskPH fault-data
distribution, its endpoint/distribution identifier, license and permitted use,
attribution, steward, update cadence, Philippine coverage/resolution, and the
scientifically approved fault-distance risk curve. Approve the published scope
as exposure distance only, not rupture or earthquake probability.

### Owner and approvers

- Owner: Data governance lead.
- Approvers: PHIVOLCS/GeoRiskPH data steward or documented authorized contact,
  legal/licensing reviewer, hazard-science lead, and geospatial engineering
  lead.

### Recommended default

Enable no connector until a steward-approved official artifact and terms are
recorded. Start with Philippines-only `LineString`/`MultiLineString` exposure
data, a documented refresh cadence, and a named science-approved distance band
and curve. Use last-known-good data only within its approved freshness limit.

### Options and trade-offs

| Option | Trade-off |
| --- | --- |
| Official machine-readable PHIVOLCS artifact | Strongest authority and reproducibility; availability/cadence may be limited. |
| Authorized GeoRiskPH distribution | May offer useful packaging; requires explicit terms and provenance verification. |
| Manual approved refresh | Lower connector risk; slower updates and more operational work. |
| Automated approved connector | Timelier data; requires reliable access, validation, monitoring, and license approval. |
| Display nearest-fault distance only | Scientifically conservative and explainable; does not give a composite risk score. |
| Use approved distance-to-score curve | Supports deterministic component scoring; requires formal scientific calibration and uncertainty wording. |

### Evidence required

- Exact approved endpoint/distribution identifier, publisher confirmation,
  artifact sample/checksum method, license/terms, attribution, and permitted
  use.
- Named data steward, review date, renewal date, and source cadence/SLA.
- Coverage, resolution, CRS, geometry, feature-status, and update-history
  assessment.
- Legal review and hazard-science sign-off on public display and the
  distance-to-risk curve/bands/uncertainty.
- PostGIS fixture results for valid/invalid geometry, coverage boundaries,
  GiST query plans, and spheroidal-distance thresholds.

### Acceptance criteria

- No ingestion can be enabled without the recorded source approval.
- Every displayed result includes approved attribution, dataset version, and
  explicit Philippine coverage/no-data state.
- Queries use approved normalized geometry, GiST indexing, `ST_DWithin`
  prefiltering, and documented `ST_Distance` semantics.
- No output infers rupture probability, fault movement, earthquake probability,
  or an official advisory.

### Deadline and effect if unapproved

- Decision deadline: before PHIVOLCS/GeoRiskPH source onboarding or any
  active-fault scoring implementation.
- If unapproved: `active_fault` remains `out_of_coverage` or `unavailable`;
  no fault connector, map layer, or component score is built or displayed.

## Decision record 3 — Authorization, privacy, audit, and model policy

**Status:** Pending

### Decision required

Approve roles and permissions for assessment snapshots, provenance details,
exports, manual sync/replay, and audit access. Approve sensitive-location
handling, precision/storage limits, retention, deletion, audit retention, and
model/provider selection and logging policy.

### Owner and approvers

- Owner: Security and privacy lead.
- Approvers: product owner, security lead, privacy/legal reviewer, data
  governance lead, and AI platform owner.

### Recommended default

Use least-privilege server-enforced roles; treat snapshot IDs as opaque
references rather than authorization. Minimize precise-location storage,
separate it from canonical grid coordinates, redact audit records, and use a
server allowlist for model/provider/version selection. Do not let clients pick
models, alter grounded context, or access provenance beyond their role.

### Options and trade-offs

| Option | Trade-off |
| --- | --- |
| Role-based access control | Straightforward administration; may be less flexible for exceptional sharing. |
| Attribute/scope-based access control | More precise cross-organization controls; higher implementation and audit complexity. |
| Store precise coordinates for a short window | Better troubleshooting and exact exports; higher privacy and breach impact. |
| Store only canonical grids after response | Better privacy; lower precision for history and support cases. |
| One approved model provider | Simplest governance and data path; resilience/vendor flexibility is lower. |
| Approved provider allowlist | Better resilience; requires per-provider security, cost, and retention review. |

### Evidence required

- Role-permission matrix and authorization test cases, including revocation.
- Data-flow and threat model for location, source metadata, prompts, outputs,
  exports, logs, and third-party providers.
- Privacy/legal assessment with retention, deletion, incident, and data-subject
  request procedures.
- AI provider security/terms review, model allowlist, cost limits, and logging
  redaction policy.
- Prompt-injection, unauthorized access, citation validation, and deterministic
  fallback test evidence.

### Acceptance criteria

- A snapshot ID alone cannot authorize any read, export, or provenance access.
- Roles are enforced server-side and revoked access is denied on subsequent
  requests.
- Precise locations, prompts, and secrets are not present in public responses
  or ordinary telemetry.
- AI responses contain only server-validated snapshot component/citation IDs,
  otherwise use the deterministic fallback.

### Deadline and effect if unapproved

- Decision deadline: before persistent snapshots, provenance APIs, exports, or
  AI integration are implemented.
- If unapproved: no user-facing snapshot persistence, export, AI grounding
  integration, or privileged sync/replay workflow may be released.

## Decision record 4 — Coverage and public-display policy

**Status:** Pending

### Decision required

Approve supported countries/regions, geographic resolution/grid policy,
out-of-coverage behavior, minimum source-quality thresholds, and public-display
limitations for each hazard and data source.

### Owner and approvers

- Owner: Product manager.
- Approvers: data governance lead, hazard-science lead, geospatial engineering
  lead, accessibility/content lead, and legal reviewer where source terms
  require it.

### Recommended default

Launch only clearly declared coverage, beginning with sources whose country,
region, bounds, resolution, and freshness meet the approved quality floor. Use
the explicit `out_of_coverage`, `unknown`, `stale`, and `suppressed` states;
never extrapolate a score or show an apparently complete national/global map
where data does not support it.

### Options and trade-offs

| Option | Trade-off |
| --- | --- |
| Philippines-first coverage | Focused validation and clear public claims; narrower initial product reach. |
| Global baseline with regional components | Broad utility; uneven quality and more no-data complexity. |
| Fine grid resolution | Better local detail; more storage, privacy, query, and false-precision risk. |
| Coarser grid resolution | More stable and private; less local differentiation. |
| Strict quality threshold | Higher trust; more `out_of_coverage` results. |
| Permissive quality threshold | More displayed coverage; higher risk of misleading results. |

### Evidence required

- Per-hazard/source coverage map, bounds, resolution, freshness, and quality
  assessment.
- Approved quality-floor rubric for authority, geometry, timeliness,
  completeness, and license/display eligibility.
- UX/accessibility review of every no-data, stale, coverage, attribution, and
  uncertainty state.
- Product/legal review of public copy, limitation notices, and prohibited
  representations.

### Acceptance criteria

- Every Map, Dashboard, export, and AI response identifies its coverage and
  resolution or explicit no-data state.
- The UI cannot present unsupported regions as scored, current, or complete.
- Sources below the approved quality floor are excluded or visibly suppressed.
- Public explanations distinguish baseline evidence, active overlays, and data
  gaps in plain language.

### Deadline and effect if unapproved

- Decision deadline: before selecting launch sources, grid precision, map
  behavior, or public display copy.
- If unapproved: no geographic rollout, resolution choice, or public
  multi-hazard display can be implemented.

## Decision record 5 — Numeric reliability, retention, and cost budgets

**Status:** Pending

### Decision required

Approve numeric targets for source freshness, assessment latency, API error
rate, spatial-query performance, sync completion and lease recovery, RPO/RTO,
data/log/snapshot retention, storage, queue capacity, and third-party API and
AI cost budgets.

### Owner and approvers

- Owner: Engineering lead.
- Approvers: product owner, platform/SRE owner, data engineering lead,
  finance/budget owner, security lead, and AI platform owner.

### Recommended default

Set separate, source-specific freshness and failure budgets rather than one
global value. Start with conservative capacity limits, page/alert thresholds,
and monthly hard cost ceilings. Set targets only after a representative load
baseline, source-SLA review, recovery drill, and user-impact assessment.

### Options and trade-offs

| Option | Trade-off |
| --- | --- |
| Strict low-latency and freshness targets | Better experience; higher database, queue, cache, and source API cost. |
| Tiered targets by source/hazard | More realistic and transparent; more monitoring and UI complexity. |
| Longer retention | Better audit/reproducibility; higher privacy, storage, and deletion burden. |
| Shorter retention | Lower cost/privacy exposure; reduced historical audit and reproducibility. |
| Hard API/AI cost cap | Predictable spend; may defer requests or show fallback content. |
| Soft budget with alerts | Fewer disruptions; can exceed budget during spikes or incidents. |

### Evidence required

- Representative workload, load/soak, cache-stampede, spatial-query, and batch
  recomputation benchmarks.
- Per-source SLA, quota, retry, and cost model; queue/database/cache/storage
  capacity analysis.
- Backup/restore and disaster-recovery drill results supporting RPO/RTO.
- Monitoring dashboard, alert thresholds, owner/on-call runbooks, and monthly
  cost forecast with escalation path.

### Acceptance criteria

- A written numeric table sets p95/p99 latency, API error, query, freshness,
  sync, lease-recovery, RPO/RTO, retention, storage, queue, and cost limits.
- Telemetry and alerts measure each limit without exposing secrets or prompts.
- Load, outage, recovery, and rollback drills meet the approved limits or have
  an approved exception and mitigation.
- Feature flags automatically/manual-trigger rollback at approved breach
  thresholds without deleting accepted datasets or snapshots.

### Deadline and effect if unapproved

- Decision deadline: before any production-like load test, scheduled sync, or
  rollout beyond local/shadow development.
- If unapproved: no production implementation, source scheduling, or user
  rollout may proceed.

## Implementation authorization checklist

Engineering begins only when every record below is **Approved** and linked to
its evidence and versioned decision record:

- [ ] 1. Deterministic scoring policy approved.
- [ ] 2. PHIVOLCS / GeoRiskPH fault-data approval completed.
- [ ] 3. Authorization, privacy, audit, and model policy approved.
- [ ] 4. Coverage and public-display policy approved.
- [ ] 5. Numeric reliability, retention, and cost budgets approved.

If any item is pending, rejected, expired, or materially changed, implementation
is not authorized. The team may continue documentation, discovery, and
non-production research only; it may not enable a source, change a schema,
ship code, alter secrets, or deploy Sprint 1 functionality.
