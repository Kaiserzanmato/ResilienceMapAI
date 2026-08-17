# Sprint 1 authorization, privacy, audit, abuse-control, and AI model-policy decision

**Decision status:** Proposed / Pending Approval
**Approval record:** Issue #9, Approval 4
**Scope:** Documentation and decision preparation only. This record authorizes no application code, identity integration, database change, source enablement, secret, deployment, or infrastructure change.

## 1. Decision requested

Approve the access-control, privacy, audit, abuse-control, and AI-model policy required before Sprint 1 can persist or share deterministic snapshots, expose provenance, run privileged sync operations, or produce grounded AI explanations.

Every duration, numeric limit, provider, model, retention period, legal basis, and incident procedure not explicitly approved below is **Unknown / Pending Approval**. This document makes no legal conclusion and does not create an authorization system by itself.

## 2. Proposed roles and least-privilege access

Access is server-enforced, default-deny, and scoped to the minimum data/action required. Role names are proposed; their concrete identity-provider mapping and entitlements remain Pending Approval.

| Role | Proposed permitted actions | Proposed prohibited actions |
| --- | --- | --- |
| Public user | View public screening content and public-source attribution allowed by coverage/display policy. | Read non-public snapshots/provenance, export restricted data, operate sync, select AI models, or access audit logs. |
| Authenticated user | Create/read own authorized assessments and permitted exports. | Access another principal’s data, unrestricted provenance, privileged controls, or raw audit logs. |
| Analyst | Read organization-authorized snapshots/provenance and create permitted analytical exports. | Modify source acceptance, override deterministic scores, operate production sync, or bypass privacy policy. |
| Data steward | Review source provenance, quality, license, coverage, and acceptance evidence within assigned scope. | Approve own conflicting evidence without recorded separation of duties, alter scores, or access unrelated user locations. |
| Administrator | Administer approved roles and policy configuration with audit trail. | Read precise locations or raw prompts by default, alter scientific scores, or bypass dual-control requirements. |
| Sync worker | Perform one server-issued, allowlisted, least-privilege job under a lease. | Serve user traffic, access unrelated datasets, expose credentials, or approve its own source output. |
| AI service | Receive only server-rendered, authorized deterministic context and return structured grounded output. | Authorize a request, select data/model/provider from client input, calculate/alter scores, or access raw secrets. |

**Acceptance criteria:** a role-permission matrix names resource, action, tenant/organization scope, owner, approval path, denial behavior, and revocation test for every allowed action. No client-provided role, persona, snapshot ID, or context grants access.

## 3. Snapshot, export, and revocation controls

### Proposed snapshot rule

Snapshots are opaque, server-issued references. A `snapshot_id` is never an authorization credential and must not be predictable, enumerable, or accepted as proof of ownership. The server authorizes every snapshot read, AI request, provenance lookup, share, and export against the authenticated principal, current role/scope, policy state, and requested action.

### Proposed lifecycle controls

- Define Pending Approval expiry, retention, revocation, deletion, legal-hold, and cache-invalidation rules for snapshots and exports.
- Re-check authorization after role, organization, consent, or policy revocation; do not rely on a previously issued link or cached client state.
- Exports require an explicit server authorization decision, applicable source-license/public-display check, location-precision policy, audit event, and expiration/revocation behavior.
- Share links, if approved later, must be scoped, opaque, revocable, expiring, and prohibited from widening access to provenance or precise-location data.
- Immutable snapshot content may be retained only under an approved privacy/retention policy; immutable does not override deletion, access revocation, or legal requirements.

**Acceptance criteria:** authorization, revocation, expiry, export-denial, sharing, tenant isolation, and stale-cache tests demonstrate that an identifier alone never grants continued access.

## 4. Sensitive location, privacy, retention, and incident access

### Proposed data-minimization rule

Treat original selected coordinates, saved location history, location-linked exports, prompts that contain locations, and precise provenance joins as sensitive location information. Store, display, export, and retain only the minimum precision needed for the approved screening use. Prefer canonical-grid precision for ordinary display where the approved coverage policy permits it.

### Pending policy decisions

| Policy area | Required decision | Current status |
| --- | --- | --- |
| Precision | Allowed precision by role, product surface, export, jurisdiction, and source terms. | Unknown / Pending Approval |
| Retention | Snapshot, precise-location, export, prompt, AI-output, audit, backup, and deletion retention periods. | Unknown / Pending Approval |
| Deletion | Verified deletion, backup treatment, legal hold, and downstream-provider deletion workflow. | Unknown / Pending Approval |
| Consent/legal basis | Applicable consent, notice, purpose limitation, and jurisdictional requirements. | Unknown / Pending Approval |
| Incident access | Who may access sensitive records during incident response, how dual approval is recorded, and post-incident review. | Unknown / Pending Approval |
| Audit retention | Retention, access, redaction, integrity, and review requirements for audit logs. | Unknown / Pending Approval |

Never place precise locations, prompts, source credentials, or secret values in public URLs, ordinary telemetry, client logs, model prompts beyond approved minimum context, or unauthenticated exports.

**Acceptance criteria:** a documented data-flow/threat model and privacy/legal review identify collection, precision, storage, display, export, deletion, backup, incident, and third-party sharing behavior. Tests prove least-precision display, deletion/revocation handling, and redacted telemetry.

## 5. Audit and incident-access policy

All privileged actions require append-oriented, tamper-evident audit events with actor/service identity, action, target class, authorization decision, policy/version, timestamp, outcome, and safe reason code. Logs must not contain secrets, raw credentials, unredacted prompts, or more precise location data than the approved audit policy permits.

Incident access is break-glass only if separately approved. It requires the Pending Approval approver set, scope, duration, reason, dual-control/separation-of-duties requirement, alerting, and retrospective review. There is no standing incident-access permission by implication.

**Acceptance criteria:** audit events are searchable by authorized reviewers, protected from ordinary modification, redacted by policy, and cover privileged reads/exports, sync controls, model/provider decisions, and break-glass events.

## 6. Grounded AI and untrusted-content boundary

AI receives only a server-rendered `GroundedRiskContext` from an authorized immutable deterministic snapshot. It cannot call scoring, source-resolution, authorization, or provider-selection logic. Map context, client-provided scores, source text, source metadata, uploaded material, user prompts, and model/provider responses are untrusted content.

The server must:

- isolate untrusted text from instructions, policy decisions, tool selection, score values, source authority, and authorization;
- enforce a size-bounded allowlist of snapshot fields and citations;
- require schema-validated structured AI output with snapshot ID, component IDs, citation IDs, uncertainty labels, and permitted preparedness content;
- validate every output component, citation, score-like value, source claim, and certainty claim against the authorized snapshot before rendering; and
- return a deterministic template from the same snapshot when AI output is unavailable, malformed, unsupported, unsafe, uncited, or unauthorized.

AI must not infer scores, missing hazards, source authority, probability, safety, official advisory status, or certainty. It may not consume `active_fault` data unless a future authorized snapshot contains approved, source-validated facts; current `active_fault` remains unavailable/out_of_coverage.

**Acceptance criteria:** prompt-injection, malicious-source-text, altered-client-context, unsupported-citation, model-failure, and cross-tenant fixtures prove server validation or deterministic fallback; no untrusted input can change a deterministic fact or access decision.

## 7. Rate limits, abuse controls, and provider/model policy

### Proposed abuse controls

Apply server-side, identity-aware and trusted-network-aware rate limits to assessment creation, snapshot reads, exports, AI requests, share operations, source/admin actions, and sync triggers. Numeric limits, windows, quotas, alert thresholds, appeal process, and enforcement actions are **Unknown / Pending Approval**. Limits must be enforced independently of client headers/personas and without exposing sensitive internal policy details.

Monitor approved redacted signals for unusual volume, repeated authorization failures, enumeration patterns, export abuse, prompt-injection attempts, provider failures, quota exhaustion, and policy violations. Define Pending Approval escalation owners, retention, alert thresholds, and incident playbooks.

### Proposed provider/model and data-sharing policy

Only a server allowlist may select a provider, model, version, task, region, and capability. Each candidate requires Pending Approval security, privacy, data-processing, retention, cross-border/data-residency, cost, availability, abuse, and output-validation review. Client requests cannot choose or override it.

Send a provider only the minimum authorized, redacted snapshot context and user input permitted by the approved policy. Do not send secrets, credentials, raw source artifacts, unrestricted provenance, unnecessary precise location, or data whose source terms prohibit sharing. Provider/model fallback is allowed only among approved entries and must preserve server validation and deterministic fallback.

**Acceptance criteria:** tests prove rate limits cannot be bypassed by header/persona manipulation, provider/model selection is server-only, denied data is never sent to providers, and every provider fallback yields validated structured output or deterministic fallback.

## 8. Owners, evidence, deadline, and non-approval effect

| Role | Required responsibility |
| --- | --- |
| Security and privacy lead — owner | Authorization, privacy, audit, abuse, incident-access, and decision record. |
| Product owner | User roles, share/export behavior, public notices, and user-impact trade-offs. |
| Legal/privacy reviewer | Data-use, retention, deletion, incident, source/provider terms, and jurisdictional analysis. |
| Backend/platform lead | Server authorization, revocation, snapshot/export lifecycle, audit integrity, and rate-limit enforcement. |
| Data-governance lead | Provenance visibility, source-license constraints, and data-sharing limits. |
| AI platform owner | Model/provider allowlist, grounded-output validation, prompt-injection controls, and fallback. |
| Incident-response owner | Break-glass process, monitoring, escalation, and retrospective review. |

### Required evidence

- role/resource/action/tenant matrix and authorization/revocation/tenant-isolation tests;
- data-flow diagram and threat model for locations, snapshots, provenance, prompts, outputs, exports, logs, backups, sync, and providers;
- privacy/legal review of precision, consent/notice, retention/deletion, incident access, and jurisdictional/provider data sharing;
- audit schema/redaction/integrity evidence and incident-access drill;
- rate-limit/abuse test plan, monitoring/alert/runbook evidence, and provider/model security/privacy/terms review; and
- grounded-AI adversarial test evidence, structured citation validation, and deterministic fallback evidence.

### Approval acceptance criteria

- Every role/action is least-privilege, server-authorized, auditable, revocable, and tested.
- Snapshot IDs and share/export references cannot grant access by themselves.
- Precision, retention, deletion, audit, incident, and provider/data-sharing controls have an approved owner, policy version, and evidence.
- AI accepts only authorized deterministic snapshot context and returns validated citations/components or deterministic fallback.
- Numeric limits, durations, legal basis, and provider approvals are recorded before implementation; no value is inferred from this template.

### Deadline and effect of non-approval

- **Proposed deadline:** before persistent snapshots, exports/shares, privileged sync/admin flows, external AI provider use, or grounded-AI implementation tickets.
- If unapproved, no Sprint 1 authorization, snapshot persistence, provenance/export, privileged sync, AI-grounding, rate-limit, or provider integration implementation may begin. Documentation and approved non-production research may continue only.

## 9. Explicit Approval 4 checklist

1. Approve the role model, least-privilege matrix, server-side authorization, and revocation/expiry/export-control requirements.
2. Approve the sensitive-location precision, privacy, retention/deletion, audit retention, and break-glass incident-access decision process; record all durations and legal requirements separately.
3. Approve immutable snapshot, sharing, and export rules, including opaque non-authorizing IDs and tenant/policy re-checks.
4. Approve the AI-only-authorized-snapshot boundary, untrusted-content treatment, structured citation/component validation, and deterministic fallback.
5. Approve the rate-limit, abuse-monitoring, prompt-injection, provider/model allowlist, and data-sharing decision framework; record numeric limits and provider approvals separately.
6. Approve the named owners, evidence package, acceptance criteria, and deadline as mandatory gates.

**Final status:** Proposed / Pending Approval. This Approval 4 decision, Approval 3’s pending signed formula/source-quality evidence, Approval 5, and source-specific evidence remain blocking requirements. No Sprint 1 implementation is authorized.
