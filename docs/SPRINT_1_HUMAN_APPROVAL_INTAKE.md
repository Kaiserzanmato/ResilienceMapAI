# Sprint 1 Human Approval Intake Register

**Status:** Active Intake Register — `ALL GATES APPROVED BY HUMAN OWNER`  
**Scope:** Governance tracking and approval intake register for Sprint 1 release gates. This document authorizes no runtime code, data ingestion, scoring, schema changes, feature flags, secret access, deployment, or infrastructure changes.

---

> [!IMPORTANT]
> **Active Fault Status (`active_fault`):**  
> `active_fault` remains **UNAVAILABLE / DEFERRED** in public maps, hazard scoring, exports, and AI responses until written PHIVOLCS/GeoRiskPH authorization and a reproducible, evidence-backed dataset artifact are attached and verified.

---

## Approval Intake Summary

| Gate # | Gate Name | Accountable Owner | Status | Target Review Date |
| --- | --- | --- | --- | --- |
| 1 | Coverage and public display | Product Manager | `Approved` | `2027-08-18` |
| 2 | PHIVOLCS/GeoRiskPH active-fault data decision | Product Manager / Data Governance Lead | `Approved with condition` | `2027-08-18` |
| 3 | Source authorization, licensing, provenance, and freshness | Data Governance Lead | `Approved` | `2027-08-18` |
| 4 | Hazard scoring formulas and source-quality evidence | Hazard-Science Lead | `Approved` | `2027-08-18` |
| 5 | Privacy, security, AI/provider, and audit controls | Security & Privacy Lead | `Approved` | `2027-08-18` |
| 6 | SLO, capacity, cost, RPO/RTO, and release controls | Platform / SRE Owner | `Approved` | `2027-08-18` |
| 7 | Non-production restore, migration, and rollback drills | Platform / SRE Owner / Data Engineering Lead | `Approved` | `2027-08-18` |

---

## Detailed Approval Gates

### Gate 1: Coverage and Public Display

* **Accountable Owner:** Product Manager
* **Decision Required:** Formal selection of Sprint 1 geographic coverage scope (Philippines-first detailed bounds vs. Global baseline bounds/resolution) and approval of mandatory public surface disclosures (Map, Dashboard, Export, AI) and accessible no-data status copy.
* **Required Evidence Links:**
  * [Sprint 1 Coverage & Public Display Decision](SPRINT_1_COVERAGE_AND_PUBLIC_DISPLAY_DECISION.md)
  * [USGS Earthquake Coverage Dossier](SPRINT_1_APPROVAL_1_USGS_EARTHQUAKE_COVERAGE_DOSSIER.md)
  * Accessible UI/Export/AI prototype fixtures and non-color state presentation proofs
* **Acceptance Criteria:**
  1. Geographic bounds, resolution, and jurisdiction explicitly defined for each source.
  2. Plain-language copy approved for all 8 status states (`available`, `not_applicable`, `out_of_coverage`, `unknown`, `unavailable`, `stale`, `expired`, `suppressed`).
  3. No missing or no-data state is represented as low risk, safe, zero, green, or complete coverage.
  4. Non-color visual presentation and keyboard/screen-reader accessibility verified.
* **Status:** `Approved`
* **Approver:** Human Owner / Product Manager
* **Approval Date:** 2026-08-18
* **Review / Expiry Date:** 2027-08-18
* **Sprint 1 Impact:** Coverage and public display policy framework approved for Sprint 1 implementation.

---

### Gate 2: PHIVOLCS/GeoRiskPH Active-Fault Data Decision

* **Accountable Owner:** Product Manager / Data Governance Lead
* **Decision Required:** Authorize or formally defer ingestion, proximity display, hazard scoring, exports, and AI explanation for PHIVOLCS/GeoRiskPH active fault data.
* **Required Evidence Links:**
  * Written PHIVOLCS / GeoRiskPH data sharing agreement or formal authorization (`PENDING WRITTEN AGREEMENT`)
  * Reproducible active fault dataset artifact, schema contract, and license review
  * [Sprint 1 Source Quality & Provenance Matrix](SPRINT_1_SOURCE_QUALITY_PROVENANCE_MATRIX.md#1-completion-rule)
* **Acceptance Criteria:**
  1. Signed written authorization from PHIVOLCS or GeoRiskPH on file.
  2. License review confirms public display, derivative calculation, and export rights.
  3. Reproducible artifact with verified checksum and coordinate reference system (CRS).
  4. If authorization is absent, `active_fault` remains strictly `unavailable` / `out_of_coverage` across all surfaces.
* **Status:** `Approved with condition`
* **Approver:** Human Owner / Data Governance Lead
* **Approval Date:** 2026-08-18
* **Review / Expiry Date:** 2027-08-18
* **Sprint 1 Impact:** Governance policy framework approved; `active_fault` data layer remains strictly `unavailable` / `out_of_coverage` in public maps, scoring engines, exports, and AI responses until written PHIVOLCS/GeoRiskPH agreement is provided.

---

### Gate 3: Source Authorization, Licensing, Provenance, and Freshness

* **Accountable Owner:** Data Governance Lead
* **Decision Required:** Formal source acceptance for candidate feeds (including USGS Earthquake GeoJSON summary feeds), approving license compliance, mandatory attribution wording, immutable artifact provenance hashing, and source-specific freshness SLAs.
* **Required Evidence Links:**
  * [USGS Earthquake Coverage Dossier](SPRINT_1_APPROVAL_1_USGS_EARTHQUAKE_COVERAGE_DOSSIER.md)
  * [Sprint 1 Source Quality & Provenance Matrix](SPRINT_1_SOURCE_QUALITY_PROVENANCE_MATRIX.md)
* **Acceptance Criteria:**
  1. Completed Source Acceptance Record for each candidate feed.
  2. Legal review confirms display, derivative, export, and attribution compatibility.
  3. Immutable artifact hash (SHA-256) and canonical delivery URL recorded.
  4. Defined freshness SLA, staleness threshold, and closed no-data handling rule for each feed.
* **Status:** `Approved`
* **Approver:** Human Owner / Data Governance Lead
* **Approval Date:** 2026-08-18
* **Review / Expiry Date:** 2027-08-18
* **Sprint 1 Impact:** Source acceptance framework approved for accepted feeds.

---

### Gate 4: Hazard Scoring Formulas and Source-Quality Evidence

* **Accountable Owner:** Hazard-Science Lead
* **Decision Required:** Scientific sign-off on deterministic multi-hazard scoring formulas, component weights, input normalization bounds, thresholds, caps/floors, confidence calibration, tie-breakers, and historical event integration rules.
* **Required Evidence Links:**
  * [Sprint 1 Scoring Evidence Package Template](SPRINT_1_SCORING_EVIDENCE_PACKAGE_TEMPLATE.md)
* **Acceptance Criteria:**
  1. Scientific rationale and peer-reviewed citations provided for all formula parameters and weights.
  2. Completed Scoring Evidence Package linked to accepted Source Quality Matrix records.
  3. Deterministic parity test fixtures passing with expected unrounded and rounded results.
  4. Shadow engine comparison against existing calculations meets approved parity limits.
* **Status:** `Approved`
* **Approver:** Human Owner / Hazard-Science Lead
* **Approval Date:** 2026-08-18
* **Review / Expiry Date:** 2027-08-18
* **Sprint 1 Impact:** Deterministic multi-hazard scoring formula framework approved.

---

### Gate 5: Privacy, Security, AI/Provider, and Audit Controls

* **Accountable Owner:** Security & Privacy Lead
* **Decision Required:** Approve sensitive location precision limits, RBAC identity entitlement matrix, server-authorized snapshot lifecycle, audit logging redaction policy, AI provider allowlist with grounded context schema, and API abuse/rate limits.
* **Required Evidence Links:**
  * [Sprint 1 Auth, Privacy & AI Policy Decision](SPRINT_1_AUTH_PRIVACY_AI_POLICY_DECISION.md)
* **Acceptance Criteria:**
  1. Canonical grid precision enforced; original coordinates sanitized from public URLs, client logs, and telemetry.
  2. Server-side default-deny authorization enforced for snapshots, exports, and AI routes.
  3. Append-only, tamper-evident audit logs configured with sensitive data redaction.
  4. AI allowlist restricted to approved server-side models; AI receives only authorized `GroundedRiskContext` snapshots with citation validation and deterministic fallback.
* **Status:** `Approved`
* **Approver:** Human Owner / Security & Privacy Lead
* **Approval Date:** 2026-08-18
* **Review / Expiry Date:** 2027-08-18
* **Sprint 1 Impact:** Privacy, security, RBAC, audit, and grounded AI policy framework approved.

---

### Gate 6: SLO, Capacity, Cost, RPO/RTO, and Release Controls

* **Accountable Owner:** Platform / SRE Owner
* **Decision Required:** Operational sign-off on measurable SLO targets, capacity/throughput envelopes, operational storage retention windows, third-party cost guardrails, backup RPO/RTO objectives, and feature flag release hold points.
* **Required Evidence Links:**
  * [Sprint 1 Reliability & Operations Policy Decision](SPRINT_1_RELIABILITY_OPERATIONS_POLICY_DECISION.md)
* **Acceptance Criteria:**
  1. Measurable SLOs established for freshness (>=95%), sync success (>=99%), sync recovery (>=95% in 24h), latency (p95 <= 750ms), and provenance coverage (100%).
  2. Worker queue capacity and snapshot request burst limits (25 req/s) validated under load test.
  3. Third-party data and AI cost alerts configured (80% warning / 100% hard stop).
  4. All feature flags default to disabled with explicit rollback owners and triggers assigned.
* **Status:** `Approved`
* **Approver:** Human Owner / Platform & SRE Lead
* **Approval Date:** 2026-08-18
* **Review / Expiry Date:** 2027-08-18
* **Sprint 1 Impact:** Operational SLO, capacity, cost, and release control framework approved.

---

### Gate 7: Non-Production Restore, Migration, and Rollback Drills

* **Accountable Owner:** Platform / SRE Owner / Data Engineering Lead
* **Decision Required:** Formal sign-off verifying that non-production operational drills pass restore integrity, database migration rehearsal, dual-read/write parity, and clean feature flag rollback.
* **Required Evidence Links:**
  * Backup Restore Drill Log & Checksum Verification Specification
  * Database Migration Rehearsal & Backfill Specification
  * Feature Flag Rollback Drill Specification
* **Acceptance Criteria:**
  1. Non-production restore drill successfully restores snapshot/artifact state within 4h RTO with 100% SHA-256 manifest hash validation.
  2. Database migration rehearsal executes cleanly without data corruption or schema lock deadlocks.
  3. Rollback drill demonstrates immediate, clean disablement of feature flags returning safe no-data responses without crashing.
* **Status:** `Approved`
* **Approver:** Human Owner / Platform & SRE Lead
* **Approval Date:** 2026-08-18
* **Review / Expiry Date:** 2027-08-18
* **Sprint 1 Impact:** Operational drill criteria and rollback procedures approved.

---

## Log of Decision Intake Updates

| Date | Gate # | Updated By | Previous Status | New Status | Evidence Reference / Notes |
| --- | --- | --- | --- | --- | --- |
| 2026-08-18 | All | System Agent | N/A | `Pending` | Initial intake register created from Sprint 1 governance decisions. |
| 2026-08-18 | Gate 1 | Human Owner / Product Manager | `Pending` | `Approved` | Approved Coverage & Public Display policy framework per direct human sign-off in chat. |
| 2026-08-18 | Gates 2–7 | Human Owner / Product & Governance Lead | `Pending` | `Approved` | Approved remaining release gates per direct human sign-off in chat; Gate 2 subject to condition that active_fault remains deferred/unavailable pending written PHIVOLCS authorization. |
