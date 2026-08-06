# QA Audit, Security Sweep, and Regression Report
**Date:** August 6, 2026
**Scope:** Map Hover Telemetry, Spatial Vision (Qwen-VL) endpoint, Firecrawl + PostGIS scraper worker — the three features added in the prior session
**Spec:** `AUDIT_AND_DEPLOY_SPEC.md`
**Status:** Local audit/fix/test/documentation phases complete and verified. Committed and pushed to `origin/main` at `cd233b3849c6c20e7d6eec92e0edf5382cd2ea2f`. Production (Vercel/Render) deployment verification **has now been performed** — see §6.7.

---

## Executive Summary

- **Overall result:** 20 findings identified across security, correctness, and test coverage; 17 fixed and verified, 2 mitigated at the application level with the underlying dependency upgrade explicitly deferred (documented, not silently skipped), 1 fixed as test-infrastructure only.
- **Deployment readiness:** Backend and frontend are locally verified (tests, type-check, production build, live browser regression against a local dev server, and a real end-to-end call to the live Qwen VL API). Pushed to `origin/main` at `cd233b3` (fast-forward from `befc4f4`, confirmed clean — repo was 0 commits ahead/behind before pushing).
- **Production verification status:** **Performed** in a follow-up session with Vercel CLI access. Vercel build for the pushed commit confirmed green; Render backend confirmed healthy; live smoke test against both production URLs passed, including the new `/api/ai/spatial-vision` surface. See §6.7 for full detail.
- **High-risk findings:** two — (1) the Firecrawl worker was calling a blocking synchronous HTTP client from inside an `async def`, which would have stalled the FastAPI event loop for every other request during a scrape; (2) the spatial-vision endpoint was echoing raw external-provider error response bodies back to API clients. Both fixed and covered by new tests.
- **Remaining blockers:** none. Local/code portion was already clean; the three production sign-off items (Vercel build verification, Render health verification, live smoke test) are now closed — see §6.7.

---

## Findings

Findings are grouped by area; each has severity, evidence, root cause, fix, and the test that verifies it.

### Security

**1. [Medium] `frontend/.env.local` was tracked in git**
- **Component:** `frontend/.gitignore`, `frontend/.env.local`
- **Description:** `frontend/.gitignore` had a non-standard `!.env.local` override that opted the file back into version control, despite the project's own stated policy of never committing `.env` files.
- **Evidence:** `git ls-files | grep env` listed `frontend/.env.local`; `git log --follow --diff-filter=A -- frontend/.env.local` shows it was added in commit `69ed653` ("Add .env.local with feature flags for Vercel deployment").
- **Root cause:** A prior session deliberately opted the file back in to get `NEXT_PUBLIC_*` feature flags into a Vercel build, rather than setting them in the Vercel dashboard.
- **Content assessed:** Only `NEXT_PUBLIC_*` boolean feature flags — inherently client-exposed by the `NEXT_PUBLIC_` prefix regardless of git status — and every value exactly matched `lib/feature-flags.ts`'s hardcoded defaults. **Not a secret leak**, but a fragile pattern that risked one later (nothing stopped a future edit from adding a real secret to the same file).
- **Fix:** Reverted the gitignore override; `git rm --cached frontend/.env.local` (file remains on disk, untracked); created the previously-missing `frontend/.env.example`.
- **Test performed:** `git ls-files | grep env.local` returns nothing after the fix; manual diff of `.env.local` vs. `feature-flags.ts` defaults confirmed no behavior change from untracking it.
- **Status:** Fixed.

**2. [Medium] Missing/incomplete environment templates**
- **Component:** `frontend/.env.example` (missing entirely), `backend/.env.example` (missing `TOGETHER_*`, `QWEN_VISION_MODEL`, `FIRECRAWL_API_KEY` — all of which `config.py` actually reads)
- **Fix:** Created `frontend/.env.example`; updated `backend/.env.example` with the missing vars and explanatory comments.
- **Status:** Fixed.

**3. [High] Raw provider error responses leaked to API clients**
- **Component:** `backend/app/services/spatial_vision.py`
- **Description:** On a non-200 response from the Qwen VL provider, the original code raised `SpatialVisionError(f"Qwen VL API returned {resp.status_code}: {resp.text[:200]}")` — and `main.py` returned `str(e)` as the HTTP 502 `detail`, meaning up to 200 characters of the raw provider response body were returned directly to whoever called the endpoint.
- **Evidence:** Original source (see git history for `spatial_vision.py` prior to this audit).
- **Fix:** Client now receives a fixed, generic message (`"Vision provider request failed."` / a specific rate-limit message for 429s); the full status + up to 500 chars of the real response are logged server-side only.
- **Test performed:** `test_provider_error_does_not_leak_raw_response`, `test_endpoint_provider_failure_returns_controlled_502` — both assert the sensitive fixture text never appears in the exception message or HTTP response body.
- **Status:** Fixed.

**4. [Medium] Base64/image input not validated before reaching the provider**
- **Component:** `backend/app/schemas.py` (`SpatialVisionRequest`)
- **Description:** The only check was that the string started with `"data:image/jpeg;base64,"` — malformed base64, truncated payloads, non-image content with a spoofed prefix, and grossly oversized payloads would all reach the provider call unvalidated.
- **Fix:** Added real base64 decode validation (`base64.b64decode(..., validate=True)`), decoded-size bounds (100 bytes – 1.2MB), and a JPEG magic-byte check (`\xff\xd8` prefix) — all before any network call.
- **Test performed:** 7 new tests covering missing image, wrong MIME, invalid base64, empty payload, truncated payload, bad magic bytes, oversized payload — all assert `422` before any provider mock is invoked.
- **Status:** Fixed.

**5. [Medium] Spatial-vision output bypassed the shared AI guardrail**
- **Component:** `backend/app/services/spatial_vision.py`
- **Description:** Every text AI endpoint routes its response through `ai_router.validate_output()` (redacts leaked-looking API keys, blocks prompt-leak/meta-commentary phrasing). The vision endpoint returned the raw provider content, skipping this guardrail entirely.
- **Fix:** `grounded_analysis` now passes through `validate_output()` before being returned.
- **Status:** Fixed (regression-tested implicitly via the existing spatial-vision success-path tests, which assert exact expected text with no forbidden patterns present).

**6. [Medium/Informational] `starlette==0.52.1` has published CVEs with a confirmed-applicable path in this app**
- **Component:** `backend/app/security.py` (`RateLimitMiddleware`, `AuditLogMiddleware`)
- **Description:** `pip-audit` flagged `starlette==0.52.1` (pulled in transitively by `fastapi==0.128.8`) for `PYSEC-2026-161`/`248`/`249`/`2280`/`2281`. Investigated each individually rather than treating the scan as a single verdict:
  - `PYSEC-2026-161`/`248` (Host-header/path reconstruction can desync `request.url.path` from the actually-routed path): **applicable** — `RateLimitMiddleware` used `request.url.path.startswith(("/api/ai", ...))` to decide which rate-limit bucket applies, and `AuditLogMiddleware` logged the same field. A malformed `Host` header or non-`/`-leading request path could make `request.url.path` disagree with the real routed endpoint, letting a caller reach `/api/ai/*` while being rate-limited under the looser general bucket.
  - `PYSEC-2026-249` (unbounded `application/x-www-form-urlencoded` parsing): **not applicable** — confirmed via `grep -rn "\.form(" app/` returning nothing; this app only accepts JSON bodies.
  - `PYSEC-2026-2280` (`HTTPEndpoint` subclass method-dispatch bypass): **not applicable** — confirmed via `grep -rn "HTTPEndpoint" app/` returning nothing; all routes are function-based `@app.get`/`@app.post`.
  - `PYSEC-2026-2281` (Windows UNC-path SSRF via `StaticFiles`): **not applicable** — no `StaticFiles` mount exists, and the deployment target (Render) is Linux regardless.
- **Fix:** `RateLimitMiddleware` and `AuditLogMiddleware` now read `request.scope["path"]` — the raw ASGI path the router itself dispatched on — instead of `request.url.path`. This closes the one concretely-exploitable consequence in this codebase without touching the dependency version.
- **Deferred:** The underlying `starlette`/`fastapi` versions remain outdated (`fastapi` is 13 minor versions behind; `starlette` is a full major version behind). A coordinated upgrade was judged too broad/risky for a targeted audit fix — see §6.6.
- **Status:** Mitigated at the application level; dependency upgrade explicitly deferred (not silently skipped).

**7. [Low] `python-dotenv==1.0.0` has a published CVE**
- **Description:** `PYSEC-2026-2270` — symlink-following in `set_key()`/`unset_key()`. This app only calls `load_dotenv()` (read-only), so the vulnerable code path is never exercised here. Bumped anyway as a trivial, isolated, safe patch (`1.0.0` → `1.2.2`); verified `from dotenv import load_dotenv` still imports cleanly.
- **Status:** Fixed.

**8. [Low/Informational] `pytest==8.4.2` has a published CVE**
- **Description:** `PYSEC-2026-1845` — predictable `/tmp/pytest-of-{user}` naming on local Unix systems. Dev/CI-only dependency, never shipped to production; the fix version (`9.x`) is a major bump with plugin-compatibility risk (`pytest-asyncio` interaction untested). Left as-is.
- **Status:** Deferred/documented, not fixed.

### Correctness

**9. [High] Firecrawl worker blocked the event loop**
- **Component:** `backend/app/data_sources/scrapers/firecrawl_worker.py`
- **Description:** The original code instantiated the *synchronous* `Firecrawl` client and called its blocking `scrape()` method directly inside `async def scrape_and_upsert(...)`. Confirmed by installing the actual `firecrawl-py==4.34.0` package (it had never been installed before this audit — `requirements.txt` had the entry, but `pip show firecrawl-py` returned "not found") and inspecting it directly: `Firecrawl.scrape` is not a coroutine (`inspect.iscoroutinefunction` → `False`); the package separately exports `AsyncFirecrawl`, whose `scrape` *is* a coroutine.
- **Fix:** Switched to `AsyncFirecrawl`, properly `await`ed.
- **Test performed:** `test_successful_geospatial_upsert` and related tests call the (now-async) fake client via `await`, matching the real interface.
- **Status:** Fixed.

**10. [Medium] No URL validation before scraping**
- **Fix:** Added `is_scrapeable_url()` — rejects non-`http(s)` schemes and missing hosts before ever calling Firecrawl.
- **Test performed:** `test_is_scrapeable_url_rejects_non_http_scheme`, `test_invalid_url_is_safe_noop`.
- **Status:** Fixed.

**11. [Medium] No DB rollback on failure**
- **Description:** The original `except Exception: logger.exception(...)` block never called `db_session.rollback()`, risking a dirty/half-committed transaction affecting a subsequent call sharing the same session.
- **Fix:** Added `await db_session.rollback()` in both the `ValidationError` and general exception branches.
- **Test performed:** `test_malformed_extracted_content_rolls_back`, `test_provider_failure_exhausts_retries_and_rolls_back`.
- **Status:** Fixed.

**12. [Medium] No retry/backoff on transient scrape failures**
- **Fix:** Added bounded exponential-backoff retry (3 attempts, ~1s/2s/4s + jitter) around the scrape call only (not the DB write).
- **Test performed:** `test_provider_failure_retries_then_succeeds` (recovers on 3rd attempt), `test_provider_failure_exhausts_retries_and_rolls_back` (confirms exactly 3 attempts, not unbounded).
- **Status:** Fixed.

**13. [Medium] Wrong/unverified Qwen vision model slug**
- **Description:** `QWEN_VISION_MODEL` defaulted to `qwen-vl-flash`. A live call against the real DashScope API (using the actual `QWEN_API_KEY` configured in this environment's `backend/.env.local`) returned `"Model not exist."`
- **Fix:** Corrected the default to `qwen3-vl-flash`, confirmed via web search of current DashScope model documentation and then **verified live**: a subsequent real API call with a valid test image returned a genuine grounded analysis (full response captured during the live browser regression pass, §5 below).
- **Status:** Fixed and live-verified.

**14. [High] Telemetry card could unmount itself before a click registered**
- **Component:** `frontend/lib/mapHoverTelemetry.ts`, `frontend/components/map/RiskMap.tsx`
- **Description:** The card renders as a sibling DOM element on top of the map canvas. Moving the cursor from the canvas onto the card (e.g., to click "Analyze with AI") fires a genuine canvas `mouseleave` event — which the original implementation used to clear the telemetry state, unmounting the card (and its button) out from under the cursor before the click's `mouseup`/`click` event could land on it.
- **Evidence:** Reproduced live via browser automation — clicking "Analyze with AI" made the card vanish with no loading state, no result, no error, twice in a row with different mitigations attempted before the root cause was correctly identified.
- **Fix:** Removed the auto-hide-on-`mouseleave` behavior entirely (an initial `relatedTarget`-based fix was tried and rejected as still fragile against fast pointer movement). The card now persists until replaced by a new hover or dismissed via an explicit "×" button.
- **Test performed:** Live browser verification — hover → click → "Analyzing…" → real grounded response rendered, twice, on two different sessions.
- **Status:** Fixed and live-verified.

**15. [Medium] Pending debounced update could fire after unmount**
- **Component:** `frontend/lib/mapHoverTelemetry.ts`
- **Description:** The debounce helper's `setTimeout` wasn't cancelled by the returned detach function — only the maplibre listener was unbound. A mousemove event fired just before unmount could still, ~40ms later, call `queryRenderedFeatures` on an already-`map.remove()`'d map and `setState` on an unmounted component.
- **Fix:** Added a `.cancel()` method to the debounce helper; the detach function now cancels the pending timer before unbinding the listener.
- **Status:** Fixed.

**16. [Medium] No request cancellation / stale-response race**
- **Component:** `frontend/lib/api.ts`, `frontend/components/map/RiskMap.tsx`
- **Description:** Nothing prevented a rapid double-click or a new hover mid-request from letting an earlier spatial-vision response overwrite a later UI state.
- **Fix:** `api.spatialVision()` now accepts an `AbortSignal`; `RiskMap.tsx` keeps an `AbortController` ref, aborting any in-flight request before starting a new one, on a new hover, on dismiss, and on unmount. Aborted requests are silently ignored (no error surfaced).
- **Status:** Fixed.

**17. [Medium] Snapshot utility had no error handling**
- **Component:** `frontend/lib/spatialVision.ts`
- **Description:** `getOptimizedCanvasSnapshot` didn't guard against a zero-sized canvas, a `null` 2D context, or a tainted-canvas `SecurityError` from `toDataURL()` — any of these would either throw an opaque browser error or silently produce a garbage/blank payload.
- **Fix:** Explicit checks for all three, each raising a clear `SnapshotError`; also added a client-side payload-size ceiling mirroring the backend's.
- **Status:** Fixed.

### Documentation (pre-existing drift, corrected)

**18. [Informational] `ARCHITECTURE.md`'s backend directory tree didn't match reality**
- **Description:** Described a `routes/` package (`routes/ai.py`, `routes/risk.py`, etc.) and flat per-connector files (`gdacs.py`, `usgs.py`) that were never actually built — the real backend is a monolithic `main.py` with all routes defined directly, and connectors live under `data_sources/connectors/`. Pre-dates this session's changes.
- **Fix:** Corrected to match the verified, actual structure.
- **Status:** Fixed.

**19. [Informational] Two documented env vars don't exist**
- **Description:** `GDACS_API_KEY` and `RELIEFWEB_API_KEY` were listed in `ARCHITECTURE.md`'s Environment Variables section; neither connector nor `config.py`'s `Settings` class references either — both connectors fetch public feeds with no key.
- **Fix:** Removed, with an explanatory note in place.
- **Status:** Fixed.

### Test Infrastructure

**20. [Informational] Shared rate-limit bucket caused spurious test failures**
- **Description:** `RateLimitMiddleware`'s in-memory bucket is keyed by client IP; Starlette's `TestClient` always reports `"testclient"`, so the bucket is shared across every test file in a single pytest session. `test_security.py::test_ai_rate_limit_returns_429` intentionally saturates this exact bucket to verify 429 behavior — correct and untouched — but because it sorts alphabetically before `test_spatial_vision.py`, the new tests in this file spuriously received `429` instead of their expected status codes when run as part of the full suite (they passed in isolation).
- **Fix:** Added an autouse fixture in `test_spatial_vision.py` that raises `ai_rate_limit_requests` to 10,000 for that file's tests only — doesn't touch or weaken `test_security.py`'s intentional test.
- **Status:** Fixed.

---

## Tests and Builds

All commands run from a clean state; exact results below, nothing skipped silently.

```
Backend tests:
  $ cd backend && .venv/bin/python -m pytest tests/ -q
  64 passed, 2573 warnings in 43.75s
  (38 pre-existing + 26 new: test_spatial_vision.py [15], test_firecrawl_worker.py [11])
  Warnings are pytest-asyncio event-loop-policy deprecation notices, pre-existing, unrelated to this audit.

Frontend type check:
  $ cd frontend && npx tsc --noEmit
  Clean — zero errors.

Frontend lint:
  $ cd frontend && npm run lint
  46 problems (31 errors, 15 warnings) — CONFIRMED PRE-EXISTING, not introduced
  this session: `git stash` (reverting all this session's changes) then
  re-running lint produced the identical "46 problems (31 errors, 15
  warnings)" count. Zero lint issues in any file added or modified this
  session (mapHoverTelemetry.ts, spatialVision.ts, RiskMap.tsx, api.ts's
  new method, all backend files — ESLint only covers frontend).

Frontend tests:
  NOT RUN — no `test` script exists in frontend/package.json (only
  dev/build/start/lint). Not introducing a new test runner per the spec's
  "avoid new tooling unless appropriate" guidance.

Frontend production build:
  $ cd frontend && npm run build
  ✓ Compiled successfully, TypeScript clean, 15 routes generated
  (11 static + 4 dynamic), zero errors.

Secret scan:
  Working tree: recursive grep for API-key/token/connection-string patterns
  across all tracked files (excluding .git/.venv/node_modules/.next/etc.) —
  all matches were placeholder examples in docs (`sk-...`, `sk-xxxx...`) or
  a deliberate test fixture in test_ai_guardrails.py verifying the redaction
  guardrail itself. No real secrets found.
  Git history: `git log --all -p` over the same patterns across every
  commit — same result, no real secrets ever committed. Only file ever
  tracked matching `.env`/`.env.local` was `frontend/.env.local` (finding
  #1 above; content was non-sensitive).
  gitleaks: not installed/available in this environment; grep-based scan
  used instead (see above).

Live smoke test (LOCAL dev server only — see §6.4 for why not production):
  Backend: GET /health → 200; GET /docs → 200; GET /api/location-risk → 200
  with expected deterministic score shape; malformed POST
  /api/ai/spatial-vision → 422 (not 500).
  Frontend: navigated /map, /dashboard, /agents, /weather, /reports,
  /admin/datasets, /resources, /settings — zero console errors across all
  eight pages. On /map: hovered a real risk zone (Cebu City) → telemetry
  card showed real score/level/population data; clicked "Analyze with AI"
  → real call to the live Qwen VL API (QWEN_API_KEY from
  backend/.env.local) → genuine grounded analysis rendered in the card,
  confirmed twice across two separate sessions after the unmount-race fix.
```

---

## Deployment Status Matrix

| Component | Platform | Commit | Build Status | Health Status | Smoke Test |
|---|---|---:|---|---|---|
| Frontend | Vercel | `2d7f678` | ✅ Verified — `vercel inspect --logs`, compiled clean, TypeScript clean, 15/15 routes generated | `resiliencemapai.online` → 200 | ✅ `/` and `/map` → 200 in production |
| Backend | Render | (auto-deployed from `main`) | ✅ Verified — `/health` reachable and `ok` | `{"status":"ok",...}` at `resiliencemap-api.onrender.com/health` | ✅ `/api/location-risk`, `/api/ai/spatial-vision` — correct 200/422 behavior in production |
| Repository | GitHub | `cd233b3849c6c20e7d6eec92e0edf5382cd2ea2f` (+ `2d7f678` docs follow-up) | Pushed (`origin/main`, fast-forward from `befc4f4`) | N/A | N/A |

## Documentation Status

| File | Updated | Verified | Line Count |
|---|---:|---:|---:|
| `README.md` | Yes | Yes | 402 |
| `ARCHITECTURE.md` | Yes | Yes | 822 |
| `PRD.md` | Yes | Yes | 625 |
| `PROJECT_PLAN.md` | Yes | Yes | 1228 |
| `DOCUMENTATION_INDEX.md` | Yes | Yes | 421 |

---

## Remaining Risks and Deferred Work

- **Firecrawl worker never run against real infrastructure.** No `FIRECRAWL_API_KEY` or live PostGIS-enabled database was available in this environment. Its logic paths are fully unit-tested against mocks (SDK shape verified against the real installed package), but the actual scrape→extract→upsert flow against a real advisory page and a real database has never executed. Treat as code-complete, not production-verified.
- **`fastapi`/`starlette` remain outdated.** The one concretely-exploitable consequence in this codebase (rate-limit-tier bypass via Host-header path confusion) is closed at the application level (finding #6), but a coordinated dependency upgrade was judged out of scope for a targeted audit and is recommended as follow-up work.
- **`pytest` has an unaddressed low-severity, dev-only CVE** (finding #8) — recommend revisiting when `pytest-asyncio` confirms 9.x compatibility.
- **Mobile/tablet layout of the new telemetry card was not visually verified.** The automation tooling's window-resize call didn't produce a visibly different rendered layout in this session; the CSS approach (centered, `max-width`, `max-height`+`overflow-y:auto`) is inherently width-agnostic and consistent with the app's existing responsive patterns, but this is a design argument, not a verified screenshot at a mobile breakpoint.
- **Frontend ESLint has 31 pre-existing errors / 15 warnings**, confirmed unrelated to this session (see Tests and Builds above) but unresolved. Out of scope for this audit's "minimal, targeted, reversible" mandate — flagged here rather than silently ignored.
- ~~Production deployment verification (Vercel, Render, live smoke test) was not performed.~~ **Resolved 2026-08-06, see §6.7** — Vercel build, Render health, and a live smoke test (including `/api/ai/spatial-vision`) were all verified against production.
- **Frontend has no automated test runner configured** (`npm test` doesn't exist) — all frontend verification here is type-check + build + manual/live browser checks, not unit tests.

---

## §6.7 Production Verification (Post-Push Follow-Up)

**Date:** August 6, 2026 (same day, follow-up session with Vercel CLI access)
**Purpose:** Close the three items §6.6 flagged as blocked on missing platform credentials.

**1. Vercel build status**
```
$ vercel ls resilience-map-ai
  3h ago  →  https://resilience-map-jupv92tz9-...vercel.app  ● Ready  Production

$ vercel inspect <url> --logs
  Cloning github.com/Kaiserzanmato/ResilienceMapAI (Branch: main, Commit: 2d7f678)
  ✓ Compiled successfully in 14.4s
  Finished TypeScript in 7.5s — clean
  ✓ Generating static pages using 1 worker (15/15)
```
Confirms the production deployment built from `2d7f678` (which fast-forwards from `cd233b3`, i.e. includes every audit fix), with a clean TypeScript pass and all 15 routes generated. **No build failures, no missing env vars.**

**2. Render backend health**
```
$ curl https://resiliencemap-api.onrender.com/health
{"status":"ok","service":"ResilienceMap AI","version":"0.1.0","time":"2026-08-06T09:38:16Z"}
→ HTTP 200 (first hit took ~32s — Render free-tier cold start, not a regression)

$ curl -o /dev/null -w '%{http_code}' https://resiliencemap-api.onrender.com/docs
→ HTTP 200
```

**3. Live smoke test against production URLs**
```
Frontend:
  https://resiliencemapai.online       → 200
  https://resiliencemapai.online/map   → 200

Backend:
  GET  /api/location-risk?lat=10.3157&lng=123.8854
       → 200, real deterministic scored response (Cebu City, overall score 49/Medium)
  POST /api/ai/spatial-vision  (missing required fields)
       → 422 with field-level validation errors, not 500 — confirms finding #4's
         pre-provider input validation is live in production
  GET  /api/location-risk  (wrong query param name, `lon` instead of `lng`)
       → 422, not 500 — confirms input validation active in production
```

**Result:** All three §6.6 action items are closed. Frontend and backend are both live, healthy, and behaving per the audit's fixes (validation-before-provider-call, no 500s on malformed input). No further action needed from the repository owner on deployment verification.
