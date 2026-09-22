# Evacuation Center Locator, Security Audit, and Remediation — Release Audit

**Audit date:** 2026-09-22 (Asia/Manila)

**Branch:** `main`

**Code revision verified:** `0997221 Add map command bar with AI risk assessment and spatial ripple effect visualization` + uncommitted working-tree changes described below (this audit's own commit supersedes `0997221` as the current revision).

## Scope

This release bundles two independent workstreams completed in the same session:

1. **New feature:** Evacuation Center Locator & Routing — a Map Layers overlay that finds the nearest evacuation centers to the active map selection, flies the camera to the closest one, and shows a wayfinding card.
2. **Security audit and remediation** — a full Gate A–D review (security controls, smoke, regression, discoverability), followed by fixes for every Critical/High finding that was safe to fix without a larger design decision, followed by a second regression pass verifying each fix.

## Feature: Evacuation Center Locator

- `frontend/lib/evacuation-centers.ts` — `EvacuationCenter` type, an 11-site curated dataset spanning Metro Manila, Calabarzon, Bicol, Leyte/Tacloban, Central Luzon, and Northern Mindanao, and a Haversine-based `getNearestEvacuationCenters()`.
- `frontend/lib/store.ts` — `showEvacuationCenters` / `selectedEvacuationCenter` state.
- `frontend/components/map/LayerControlWidget.tsx` — "Critical infrastructure" toggle.
- `frontend/components/map/EvacuationCard.tsx` — wayfinding card (status, address, distance, safety instructions, Google Maps directions link).
- `frontend/components/map/RiskMap.tsx` — marker placement, fly-to, and card anchoring, with a fix applied during testing: the card flips below its marker (instead of always rendering above) and clamps horizontally, so it can never render underneath the fixed header when the marker lands near the top of the viewport.
- Verified live in-browser: toggle on/off, marker click-to-reselect, "Close", and cleanup all function correctly; `npm run build` clean at the time.

## Security audit findings and remediation

Full methodology: `code-reviews` skill (security controls / smoke / regression / discoverability gates). Findings below were reproduced against the local dev instance, not assumed from source alone.

| # | Finding | Severity | Status |
|---|---|---|---|
| 1 | `frontend/app/api/admin/datasets/upload/route.ts` attached `ADMIN_SHARED_SECRET` + `dataset_admin` role to **every** caller unconditionally — the public, unauthenticated `/admin/datasets` page (linked from primary nav) could write arbitrary entries into the dataset source registry. Reproduced live with a bare `curl` POST (no session, no credentials) → `200` + registry write. | **Critical** | **Fixed.** The proxy now requires the caller to present a matching `x-admin-key` header (`timingSafeEqual` comparison) before it forwards the secret; a password field was added to the admin form. Re-verified: no-key/wrong-key → `401`, correct key → `200`. |
| 2 | `next` 16.3.0 had two unauthenticated-RCE CVEs (GHSA-p293-qw3h-jr36, GHSA-2xp9-vwfh-vxw4); `nanoid` 3.3.17 and `sharp` 0.35.3 each had a High CVE. | **Critical/High** | **Fixed** via `npm audit fix` (non-breaking): `next`→16.3.5, `nanoid`→3.3.19, `sharp`→0.35.4. |
| 3 | `maplibre-gl` 5.24.0 has a Critical XSS-sanitizer-bypass CVE (GHSA-jrc7-96c5-q579); requires a major bump to 6.10.0. | **Critical** | **Deferred by decision** — needs a separate compatibility-testing pass, not bundled into this release. |
| 4 | `RiskMap.tsx`'s alert/event marker popups built HTML via raw template-literal interpolation into `.setHTML()` — not exploitable today (the interpolated fields are static sample data) but a latent sink one data-source change away from being reachable, compounded by finding #3. | **High** | **Fixed.** Both call sites now build popup content via `textContent`/`setDOMContent` (new `buildPopupContent()` helper), matching the pattern already used safely for realtime events. Re-verified: no `setHTML` calls remain in the file; popup rendering confirmed visually unchanged. |
| 5 | `GET /api/reports` is a public, unauthenticated listing of every shared report ever created, defeating the "unguessable share-link" model. | **High** | **Deferred by decision** — needs a product decision on the intended access model; not a code defect to silently patch. |
| 6 | No CSP/`X-Content-Type-Options`/`X-Frame-Options`/`Referrer-Policy`/`X-XSS-Protection` on either service; no `robots.txt`/`sitemap.xml`/`llms.txt` at all (all `404`); no OG tags or JSON-LD on the homepage. | **Medium** | **Partially fixed.** Added `robots.txt`, `sitemap.xml`, `llms.txt` to `frontend/public/`; added `X-Content-Type-Options`, `X-Frame-Options`, `X-XSS-Protection`, `Referrer-Policy` globally (including `/api/*`) in `frontend/next.config.ts`. A full CSP and OG/JSON-LD tags remain open. |

### Regression pass (fix verification)

Re-ran the original exploit reproduction and checks against the fixed code:

- Fix #1: no-key → `401`, wrong-key → `401`, correct key → `200`, registry cleaned up. Confirmed no sibling proxy has the same pattern (`ADMIN_SHARED_SECRET`/`x-role` usage is confined to this one route; `/api/data-sync` has no frontend caller at all).
- Fix #2: `npm audit --omit=dev` now reports exactly one finding — the deliberately-deferred `maplibre-gl` CVE.
- Fix #4 (setHTML): zero `setHTML` calls remain in `RiskMap.tsx`; the three remaining `innerHTML` uses are static marker-icon skeletons with no interpolated data.
- Fix #6: `robots.txt`, `sitemap.xml`, `llms.txt` all return `200`; all four headers confirmed present on both page routes and API routes.
- Visually re-verified the `/admin/datasets` form in-browser: the new "Admin key" field renders correctly, layout intact, no regression.

## Validation record

| Check | Status | Result |
|---|---|---|
| Frontend TypeScript | passed | `npx tsc --noEmit -p .` clean |
| Frontend production build | passed | `npm run build` — all 17 routes generated, zero errors |
| Frontend lint | passed (pre-existing warnings only) | `npm run lint` — 2 warnings in `MapCommandBar.tsx` (unused `AlertCircle`/`riskColors`), open from an earlier `/code-review` pass, unrelated to this release |
| Backend suite | passed | `pytest tests/ -q`: 86 passed |
| Frontend dependency audit | passed except deferred item | `npm audit --omit=dev`: 1 critical (`maplibre-gl`, deferred by decision) |
| Backend dependency audit | passed | `pip-audit -r requirements.txt`: no known vulnerabilities |
| Secret scan | passed | `bash scripts/audit-secrets.sh`: no suspicious tracked credentials |
| Live exploit reproduction + fix verification | passed | See regression pass above |

## Documentation inventory

| Document | Present | Current after this audit |
|---|---:|---:|
| README | yes | updated — new feature capability bullet, "Recent fixes" section, corrected the RBAC-proxy description to match the fixed behavior |
| PRD | yes | updated — Evacuation Center Locator added under Key Features |
| Technical documentation | yes: `TECHNICAL_DOCUMENTATION.md` | updated — admin-proxy auth model corrected |
| QA/regression/security | this audit | current scope and gaps recorded |
| Changelog/release notes | this audit | yes |

## Release decision

Safe to ship. The one live-reproduced Critical (dataset-registry privilege escalation) is fixed and re-verified; dependency CVEs with non-breaking fixes are patched; the latent XSS sink is closed. Two items are **deliberately not included** in this release and should not be read as overlooked: the `maplibre-gl` major-version migration (needs its own compatibility pass) and the `/api/reports` public-listing access model (needs a product decision, not a silent code change).

## Rollback

Revert this commit and redeploy the prior `main` revision (`0997221`) from Vercel for frontend changes; no backend schema or migration changes were introduced in this release. No credentials were rotated or need rotating as part of this release — no secret was found to have leaked (see Secret scan above); the `ADMIN_SHARED_SECRET` fix only changed who must present the existing secret, not its value.
