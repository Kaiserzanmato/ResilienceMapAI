# Final Deployment And Documentation Release Audit

**Audit date:** 2026-08-07 (Asia/Manila)

**Branch:** `main`

**Code revision verified:** `fa247d5 fix: expose safe geocoder provider diagnostics`

## Deployment matrix

| Target | Status | Evidence | Notes |
|---|---|---|---|
| GitHub | verified | `origin/main...main` was `0 0` | `fa247d5` is the checked revision. |
| Vercel | verified Ready | `vercel list resilience-map-ai --yes` showed the latest production deployment Ready | `https://resiliencemapai.online/` and `/map` returned HTTP 200. The deployment-to-commit mapping was not exposed by the CLI output during this audit. |
| Render | partially verified | `/health` returned HTTP 200 and live endpoints returned the safe-diagnostics contract | `/health` exposes application version `0.1.0`, not Git SHA; commit identity cannot be proven from that endpoint alone. |
| Production website | smoke-tested | HTTP 200 for `/` and `/map` | Browser interaction and console verification were not available in this audit. |

## Production API evidence

`GET /api/geocode` returned `provider: geoapify`, `fallback_used: false`, and
`provider_status.geoapify: success` for all seven queries below. This validates
the primary provider and safe diagnostics, not LocationIQ fallback.

| Query | Result assessment |
|---|---|
| Tokyo Station, Japan | Exact candidate: Tokyo Station, Chiyoda, JP. |
| Nairobi Hospital, Kenya | Exact candidate: Nairobi Hospital, Nairobi, KE. |
| Tehran Grand Bazaar, Iran | Exact candidate: Grand Bazaar, Tehran, IR. |
| Avida Towers San Lazaro, Philippines | Broad/incorrect top candidate: San Lazaro, Northern Samar. |
| Avida Towers Sucat, Philippines | Approximate top candidate: Avida Towers Altura, Muntinlupa. |
| Maya Beach Club, Da Nang, Vietnam | Broad top candidate: Beach Club, Da Nang. |
| VK Pods Jakarta @PIK, Indonesia | Incorrect top candidate: Plush Pods, Singapore. |

`POST /api/assessments` returned 13 hazard records for Tokyo Station and a
Singapore control coordinate. Each had one numeric hazard and twelve explicit
no-data hazards; `overall_score` and confidence were `null`, which is correct
under the two-numeric-score aggregation rule. This validates no-data semantics,
not broad hazard-data completeness. AI, reports/exports, visual map updates,
and browser console/network behavior were not revalidated in this audit.

## Validation record

| Check | Status | Result |
|---|---|---|
| Frontend lint | passed | `npm run lint` passed after the address-display change. |
| TypeScript | passed | `npx tsc --noEmit` passed after the address-display change. |
| Frontend tests | skipped | No `npm test` script is configured. |
| Frontend production build | passed | `npm run build` passed and produced `.next/BUILD_ID`. |
| Backend suite | passed | `pytest tests/ -q`: 76 passed, 3,191 pytest-asyncio/Python 3.14 deprecation warnings. |
| Backend formatter/lint/type checks | skipped | No corresponding repository command is configured. |
| Dependency audit | passed | `npm audit --omit=dev --json` reported zero findings. |
| Secret scan | passed with local-env notice | `bash scripts/audit-secrets.sh` passed; `backend/.env.local` is absent locally. |

## Documentation inventory

| Document / equivalent | Present | Current after this audit |
|---|---:|---:|
| README | yes | yes |
| PRD | yes | needs a future product-planning refresh for global search acceptance criteria |
| Architecture | yes | needs a future architecture refresh for the provider gateway diagram |
| Technical/API/environment/provider registry | yes: `TECHNICAL_DOCUMENTATION.md` | yes |
| Database/PostGIS | yes: `ARCHITECTURE.md` and technical document | current limitations recorded |
| Deployment and rollback | yes: `DEPLOYMENT.md`, `DEPLOYMENT_GUIDE.md`, technical document | current routing recorded |
| QA/regression/security | yes: `AUDIT_REPORT.md` and this audit | current scope and gaps recorded |
| Implementation/console log | yes: `PROJECT_PLAN.md`, `IMPLEMENTATION_SUMMARY.md` | historic; this audit is the current release record |
| Changelog/release notes | this audit | yes |

## Release decision

The services are live and the primary Geoapify integration is working. This
release must **not** be described as fully verified for granular global
property search: the query matrix contains broad and incorrect candidates, and
LocationIQ fallback, interactive selection, AI, reports/exports, and browser
console checks have not been validated in this audit. The map now displays each
candidate's full normalized address to support explicit user verification.

## Rollback

Redeploy the last known-good `main` revision from Vercel for frontend changes
and Render for backend changes. Confirm the provider-specific `/health`,
`/api/geocode`, and `/api/assessments` smoke tests after rollback. Never expose
or rotate geocoder credentials through a Git commit; manage them in Render.
