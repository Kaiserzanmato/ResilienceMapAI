# Sprint 1 reliability, recovery, rollout, and cost policy decision

**Decision status:** Proposed / Pending Approval

**Approval record:** Issue #9, Approval 5

**Scope:** Planning and decision preparation only. This record authorizes no application code, migration, ingestion, source enablement, secret, configuration, infrastructure, Vercel, Render, or production deployment change.

## 1. Decision required and implementation gate

Approve operating objectives, resilience goals, capacity and cost guardrails, feature-flag sequencing, and release controls for Sprint 1 deterministic hazard synchronization and immutable snapshots. Every numeric value below is a conservative **Proposed / Pending Approval** planning value only, not a production SLO, budget, quota, limit, or release criterion.

Sprint 1 remains blocked pending signed Approval 3 formula and source-quality evidence, Approval 5 approval, legal/privacy and retention/deletion decisions, approved numeric limits and permitted AI providers, and source-specific authorization, licensing, validation, freshness, and public-display evidence.

## 2. Proposed measurable SLOs

All metrics require a measurement source, denominator, time window, coverage state, and owner. `out_of_coverage`, `unavailable`, `unknown`, `stale`, `expired`, and `suppressed` are closed no-data states, never low-risk results and never successful scored coverage.

| Measure | Conservative proposed value — Pending Approval | Measurement and safe failure |
| --- | --- | --- |
| Accepted artifact freshness | At least 95% meet their approved per-source freshness SLA. | Compare accepted `refreshed_at` to the approved source SLA; return stale/expired when missed. |
| Sync success | At least 99% of due scheduled runs reach accepted promotion over 30 days, excluding approved maintenance. | Count durable terminal states; report skipped, leased, circuit-open, and failed runs separately. |
| Sync recovery | At least 95% of retryable failures recover or reach an owned dead-letter disposition within 24 hours. | Measure first failure to promotion or acknowledged disposition. |
| Authorized snapshot read latency | p95 ≤ 750 ms and p99 ≤ 1.5 s for cached server reads. | Record cache state, response class, region, and authorization outcome. |
| Deterministic snapshot creation latency | p95 ≤ 2 s using already accepted data. | Timeout returns explicit unavailable/error, never an inferred score. |
| Map data request latency | p95 ≤ 1 s for a supported coverage cell. | Instrument client rendering separately from API latency. |
| Server error rate | Less than 1% 5xx on supported score/snapshot routes over 30 days. | Separate authorization, validation, source no-data, and upstream responses. |
| No-data outcome rate | No numeric target until per-hazard coverage baselines exist. | Report every state/reason; never aggregate it as low risk. |
| Provenance coverage | 100% of public scores include snapshot ID, score version, manifest reference, attribution status, and freshness state. | Withhold a score missing any required field. |

**Acceptance criteria:** durable telemetry and fixtures calculate every approved metric; a breach pages the named owner and preserves explicit safe no-data behavior.

## 3. Proposed capacity, queue, storage, and third-party cost budgets

These are planning guardrails only. Re-estimate them from approved coverage, source terms, resolution, traffic forecasts, provider pricing, and load tests before enabling a source or feature.

| Area | Conservative proposed value — Pending Approval | Evidence required |
| --- | --- | --- |
| Sync queue | One worker-concurrency unit per approved source; alert at 100 pending jobs or 15 minutes oldest-job age. | Source cadence, observed runtime, retries, and soak results. |
| Snapshot/score capacity | 10 authorized requests/sec sustained and 25/sec for a five-minute burst per initial supported region. | Traffic forecast, cache design, load test, and rate-limit policy. |
| Operational storage | 90-day hot window for accepted artifacts, manifests, and snapshots only if privacy/legal and source terms approve. | Retention/deletion, artifact sizing, backup, and license evidence. |
| Redacted telemetry | 30 days only if privacy/legal approves; never raw secrets or precise locations by default. | Redaction tests and privacy/incident evidence. |
| Third-party data costs | Alert at 80% forecast monthly use; hard-stop at 100% only where terms and product approval permit. No currency amount is proposed. | Pricing/rate terms, source contract, owner, and safe fallback. |
| AI provider costs | No provider, model, quota, or budget is proposed. | Approval 4 provider/privacy evidence, cost terms, abuse controls, and deterministic fallback evidence. |

**Acceptance criteria:** capacity/cost telemetry is redacted, attributable to an approved workload, alertable before a hard limit, and tested to fail safe without bypassing authorization or inventing data.

## 4. Proposed backup, restore, RPO, and RTO objectives

| Objective | Conservative proposed value — Pending Approval | Evidence required |
| --- | --- | --- |
| RPO for accepted data/manifests | At most 24 hours of accepted-state loss. | Backup inventory, restore-point verification, and source replay plan. |
| RTO for score/snapshot service | Safe read-only or explicit-unavailable state within 4 hours. | Restore drill, dependency map, and owner acknowledgement. |
| RTO for a source sync | Queued scheduling restored within 24 hours, subject to source availability and terms. | Lease recovery, dead-letter replay, and source escalation evidence. |
| Restore integrity | 100% of restored snapshots validate manifest/artifact hashes before public use. | Restore fixture, checksum validation, authorization test, and audit record. |

Backups and replay artifacts remain subject to pending privacy/legal retention, deletion, and source-term decisions. Immutable records do not override those obligations.

**Acceptance criteria:** a non-production restore drill proves integrity, authorization, stale-state handling, and last-known-good recovery. Failure blocks release.

## 5. Proposed feature flags, migration, dual-read, and dual-write sequence

All flags are disabled by default, server-controlled, audited, scoped, and reversible. Client-provided flags, scores, and snapshot context are never authoritative.

| Proposed flag / phase | Default — Pending Approval | Advance gate | Rollback |
| --- | --- | --- | --- |
| `hazard_sync_shadow` | Disabled | Approved source, isolated staging, state-machine tests. | Disable workers; preserve accepted last-known-good data. |
| `deterministic_score_dual_read` | Disabled | Signed formula evidence, parity fixtures, privacy/authorization tests. | Use existing path only; retain redacted comparison telemetry. |
| `deterministic_score_dual_write` | Disabled | Migration/backfill rehearsal, idempotency/conflict/restore evidence. | Stop new writes; use approved recovery process. |
| `server_snapshot_public_read` | Disabled | Coverage/public-display and source evidence; authorization review. | Return explicit unavailable/out-of-coverage; revoke cache/share access. |
| `grounded_ai_explanations` | Disabled | Approval 4 evidence, provider approval, citation validation, fallback tests. | Disable AI route; deterministic explanation only. |

**Proposed sequence:** non-production migration rehearsal → validated backfill → shadow sync → dual-read parity → dual-write reconciliation → internal snapshot access → narrow public display → regional/hazard expansion. Every phase requires its listed gate and all cross-cutting approvals.

**Acceptance criteria:** every flag has an owner, allowlisted audience, telemetry, review date, disable test, and explicit no-score behavior when evidence is absent.

## 6. Proposed rollout hold points, rollback triggers, monitoring, and owners

1. **Pre-build hold:** all five decision records and source-specific evidence are approved.
2. **Pre-migration hold:** restore, privacy, authorization, and source-license evidence is accepted; rehearsal passes.
3. **Pre-public-score hold:** signed formula/source matrix, parity/spatial tests, and coverage disclosures pass.
4. **Expansion hold:** load/soak, cost, freshness, no-data, accessibility, and incident/rollback drills meet approved thresholds per region.

### Rollback triggers — Pending Approval

- Missing required provenance, snapshot, freshness, or disclosure fields.
- Source authorization/license failure or term revocation.
- Parity, manifest/hash, authorization, sensitive-location, or grounding validation failure.
- An approved SLO breach sustained for its approved window.
- Queue, dead-letter, storage, or third-party cost crossing an approved alert/stop threshold.
- Failed restore, rollback, audit-integrity, or incident-access drill.

Rollback disables the narrowest affected flag, returns an explicit safe state, preserves redacted evidence, and uses last-known-good data only within approved freshness and licensing bounds. It must not silently substitute a lower score, different source, stale data, or inference.

| Evidence area | Proposed accountable owner — Pending Approval |
| --- | --- |
| SLOs, dashboards, API/map/snapshot performance | Backend/platform lead |
| Freshness, recovery, provenance | Data engineering lead and data-governance lead |
| Formula parity and hazard semantics | Hazard-science lead and risk-scoring product owner |
| Capacity, backup/restore, alerts, drills | Platform/SRE owner |
| Cost and vendor limits | Product owner with finance/procurement owner |
| Privacy, retention, deletion, sensitive location | Security/privacy lead and legal/privacy reviewer |
| AI provider, abuse, grounding | AI platform owner and security lead |

**Acceptance criteria:** every alert and rollback condition has an owner, escalation path, data source, approved threshold, severity, and exercised runbook. No automatic rollback deletes accepted source data.

## 7. Approval checklist

Record an explicit **Approved**, **Rejected**, or **Revised** decision and rationale for each item. Until all applicable items are Approved, this brief remains Proposed/Pending Approval and Sprint 1 implementation remains blocked.

1. **SLO measurement contract:** approve metric definitions, denominators, closed no-data handling, and section 2 targets—or replace every target with evidence-backed values.
2. **Capacity and cost envelope:** approve queue, throughput, storage, telemetry, and third-party cost guardrails after product/provider/privacy evidence is supplied.
3. **Resilience objectives:** approve or revise RPO/RTO and restore-integrity objectives after a non-production restore drill.
4. **Change-control sequence:** approve disabled-default flags, migration/backfill rehearsal, dual-read/dual-write gates, and rollback semantics.
5. **Release controls:** approve hold points, monitoring/alert thresholds, rollback triggers, and accountable owners. Final numeric thresholds must be recorded before public release.

### Required evidence

- Approved coverage/source cadence and terms, traffic forecast, provider pricing/rate terms, and total-cost model.
- Representative load, queue, retry, no-data, and soak results.
- Non-production backup/restore, rollback, migration, and dead-letter drills.
- Dashboard, alert runbook, owner/on-call, and safe-state UX evidence.
- Signed Approval 3 formula/source-quality evidence and applicable Approval 4 privacy/provider evidence.
- Written source-specific authorization, licensing, validation, provenance, freshness, and public-display evidence.

**Proposed deadline:** before any Sprint 1 migration, connector, background sync, deterministic-score, snapshot, public-display, or grounded-AI ticket begins.

**Effect if unapproved:** flags remain disabled. No migration, dual-read/write, data synchronization, score/snapshot implementation, public rollout, provider use, or production deployment is authorized. Planning and approved non-production evidence collection may continue only.
