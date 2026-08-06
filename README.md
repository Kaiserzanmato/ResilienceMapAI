# ResilienceMap AI

Immersive AI-powered disaster risk intelligence platform — interactive hazard maps,
executive dashboards, grounded AI insights, and exportable reports.

## Architecture

```
resiliencemap-ai/
├── frontend/   Next.js 16 + React 19 + Tailwind v4 + MapLibre GL + Recharts + Framer Motion
└── backend/    FastAPI + deterministic risk engine + AI provider abstraction + ReportLab exports
```

**Core principle:** `hazard data → backend scoring → risk color → AI explanation`.
The AI explains calculated scores; it never invents them, predicts disasters, or
overrides official advisories.

## Quick start

### Backend (port 8000)

```bash
cd backend
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
cp .env.example .env          # optional: add AI provider keys
.venv/bin/uvicorn app.main:app --reload --port 8000
```

Without AI keys the platform runs in **deterministic local mode** — fully functional,
with template insights generated directly from engine output.

### Frontend (port 3000)

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:3000.

### Tests

```bash
cd backend && .venv/bin/python -m pytest tests/ -q
```

## Features

- **Landing** (`/`) — premium Apple/Gemini-inspired marketing page
- **Map** (`/map`) — 6 map views (standard/satellite/terrain/hybrid/dark/light),
  hazard layers, heatmap, risk zones, active alerts, historical events, floating
  widgets, animated zoom-to-location, click-to-assess
  - **Hover telemetry** — a debounced (40ms) card following pointer position,
    reading whatever risk-zone/heatmap features are already rendered under the
    cursor (no extra network calls): coordinates, zone name/country, hazard
    score/level, population. See `frontend/lib/mapHoverTelemetry.ts`.
  - **Spatial Vision ("Analyze with AI")** — downsamples the map canvas
    (≤1024px, JPEG q0.7) and sends it with the deterministic risk context to
    `POST /api/ai/spatial-vision`, which asks a vision-capable Qwen model
    (`QWEN_VISION_MODEL`, default `qwen3-vl-flash`) to ground its analysis in
    official sources. Requires `canvasContextAttributes: { preserveDrawingBuffer:
    true }` on the map (already set, for PDF export). Falls back to a
    deterministic local response when `QWEN_API_KEY` is unset. Requests are
    cancellable and self-cancelling (`AbortController`) — a new hover or a
    repeated click can never let a stale response overwrite a newer one.
- **Weather Map Forecast** (`/weather`) — live OpenWeatherMap tile layers
  (precipitation/clouds/wind/temperature/pressure) on a MapLibre map, click
  anywhere for current conditions, plus a link out to Zoom.Earth for full
  storm tracking. Zoom.Earth has no public API and sends
  `X-Frame-Options: SAMEORIGIN` (blocks iframe embedding), so its data isn't
  embedded directly — see `frontend/components/weather/` and
  `frontend/app/api/weather-tiles/`, `frontend/app/api/weather-current/`
  (both server-side proxies keeping `OPENWEATHERMAP_API_KEY` out of the
  browser, with best-effort rate limiting via `frontend/lib/rateLimit.ts`
  to protect the free tier's shared quota).
- **Dashboard** (`/dashboard`) — executive KPI cards + interactive charts.
  Stats are served through a same-origin cache
  (`frontend/app/api/dashboard-stats/route.ts`, `unstable_cache`, 60s
  window) rather than fetched directly from the backend — the Render free
  tier's cold/slow connection setup was otherwise blocking every dashboard
  load; now only the first request per minute pays that cost.
- **AI Workspace** (`/agents`) — persona-based, source-grounded assistant
- **Reports** (`/reports`) — PDF briefs, CSV exports, executive summaries, share links
- **Resources** (`/resources`) — documentation links, data sources, research datasets with
  functional "Learn more" links and full dataset access
- **Datasets** (`/admin/datasets`) — source provenance + metadata-validated registration (RBAC)
  with enhanced features:
  - **Search functionality** — filter sources and datasets by name, organization, coverage, domains
  - **Smart refresh** — 1-hour rate limiting prevents API overload, shows full timestamp of last sync
  - **"What's New" button** — displays detailed update information showing which sources changed,
    their sync status, record counts, and exact sync timestamps
  - **Rate limit transparency** — countdown timer shows when next refresh is available
- **Settings** (`/settings`) — theme (light/dark/system/high-contrast), persona, map defaults
- **Ambient globe** — a subtle, continuously rotating background globe on every page
  except `/map` and `/weather` (`frontend/components/globe/AmbientGlobe.tsx`), built on
  the existing `d3-geo`/`d3-timer`/`topojson-client` stack (no new dependency).
  Theme-reactive, respects `prefers-reduced-motion`, pauses when the tab is
  backgrounded, hidden on small viewports. World-atlas data is served from a local
  static asset (`frontend/public/countries-110m.json`) rather than an external
  CDN — the CDN fetch used to fail inconsistently (ad-blockers, network variance),
  which is why the globe didn't reliably render; it's also ~40% larger now
  (`min(68vw, 980px)` vs. the previous `min(50vw, 700px)`).

## Security

- All AI calls server-side; no keys in the browser
- Pydantic input validation on every endpoint; output redaction
- Prompt-injection detection (flagged input is treated as data, not instructions)
- Sliding-window rate limiting (tighter budget for AI endpoints), keyed off
  the raw ASGI-routed path (`request.scope["path"]`), not `request.url.path`
  — the latter is reconstructed from the client-supplied `Host` header in
  the pinned `starlette==0.52.1` and can be desynced from the actual routed
  path by a malformed header (PYSEC-2026-161/248), which could otherwise let
  a caller dodge the tighter AI-endpoint rate limit
- Long-window usage quotas, separate from the burst rate limiter above
  (`app/services/usage_quota.py`, per-IP): Insights is capped at 3
  generations per 5h; the AI Agent panel and AI Workspace chat share one
  50/day budget (resets at UTC midnight). `GET /api/usage-status` reports
  current usage without consuming a hit — it drives the usage meters shown
  in the UI next to each of those three features.
- Audit logging on all `/api` routes
- RBAC-ready role model (`public_user` → `super_admin`); dataset mutation requires `dataset_admin`
- CORS restricted to the frontend origin
- Spatial-vision image input (`/api/ai/spatial-vision`) is validated before
  ever reaching the AI provider: JPEG data-URL prefix, valid base64 syntax,
  decoded size bounded (100 bytes–1.2MB), JPEG magic-byte check. Provider
  errors are logged in full server-side but the client only ever sees a
  generic message — raw provider response bodies are never echoed back.
  Output runs through the same `validate_output()` guardrail (redacts
  leaked-looking keys, blocks prompt-leak phrasing) as the text AI endpoints.

**Known limitation — RBAC is not real authentication.** `X-Role` is a
client-supplied header with no identity behind it; anyone can claim any role.
As a stopgap, elevated roles (`analyst` and above) additionally require an
`ADMIN_SHARED_SECRET` sent as `Authorization: Bearer <secret>` (see
`app/security.py`). This blocks opportunistic third-party abuse of the
endpoint directly, but it is **one static secret, not per-user identity** —
it does not restrict which site visitors can use the app's own admin UI
(there's no login to distinguish them yet). The frontend never holds this
secret directly: `frontend/app/api/admin/datasets/upload/route.ts` is a
server-side proxy that attaches it. Real authentication (JWT/OAuth) is not
yet built.

## Data sync & persistence

Four sources have real connectors and are wired into scheduled sync: GDACS,
NASA EONET, USGS Earthquake, ReliefWeb (`backend/app/data_sources/`). The
registry (`sources_registry.py`) also lists other approved sources — most
without a connector yet, registered for discoverability, not sync
(`GET /api/source-registry`, `GET /api/sync-health`).

- **Scheduling**: `vercel.json`'s `crons` entry hits
  `GET /api/cron/sync-sources` once daily (00:00 UTC), authenticated by
  `CRON_SECRET`. If `CRON_SECRET` isn't set, the app still starts (it logs a
  warning, not a fatal error — an earlier version of this check crashed the
  whole backend on every deploy when the secret was missing; see commit
  `b18f89b`) but the cron endpoint rejects every request, including Vercel's
  own scheduler, until it's configured. **Note**: `b18f89b` alone did not
  actually resolve that outage — the real cause was `sqlalchemy==2.0.36`
  being incompatible with Python 3.14 (Render's unpinned default at the
  time), fixed in `7659823` by upgrading SQLAlchemy and adding
  `backend/runtime.txt` to pin the Python version. Vercel's Hobby plan only allows daily
  cron jobs; upgrade to Pro and shorten the schedule (e.g. `*/15 * * * *`)
  for more frequent sync. `POST /api/data-sync` (RBAC-gated) triggers the
  same dispatch manually anytime in between.
- **Persistence**: sync health, the sync audit log, uploaded-dataset
  metadata, and shareable reports all live behind a repository interface
  (`backend/app/repositories/`) with two implementations — in-memory
  (default; state is lost on every restart) and Postgres-backed, selected
  automatically by whether `DATABASE_URL` is set. **Provision Postgres via
  the Vercel Marketplace** (e.g. Neon) — see the `marketplace` Claude Code
  skill for that step; this repo doesn't pick a provider for you.
- **Migrations**: Alembic (`backend/alembic/`), applied out-of-band — e.g.
  `vercel env pull` then `alembic upgrade head` from a dev machine — never
  automatically inside the serverless function. Prefer setting
  `ALEMBIC_DATABASE_URL` to the direct/unpooled connection string for DDL.

**Firecrawl advisory scraper** (`backend/app/data_sources/scrapers/firecrawl_worker.py`):
scrapes unstructured hazard advisories (PAGASA/PHIVOLCS/JMA bulletins, etc.)
and upserts them into a PostGIS-backed `hazard_events` table
(`alembic/versions/0002_hazard_events.py`) via `AsyncFirecrawl` with Qwen-
style schema-based extraction. Safely no-ops when `FIRECRAWL_API_KEY` is
unset. **Not yet wired into scheduled sync** — `run_all_wired_sources()`
doesn't call it; invoke `FirecrawlIngestionWorker().scrape_and_upsert(url,
session)` directly until a registry entry exists (see ARCHITECTURE.md's
Future Improvements). Bounded retry (3 attempts, exponential backoff) on
transient scrape failures; rolls back the DB session on any failure so a
bad scrape can't leave a half-written transaction behind.

**Frontend/backend source-registry reconciliation**:
`backend/app/data_sources/registry/sources_registry.py` is the single source
of truth. `frontend/data-sources/registry/sources.registry.ts` is a
generated file — regenerate it with
`backend/.venv/bin/python backend/scripts/export_ts_registry.py` after
editing the Python registry. Never hand-edit the `.ts` file.

## Deployment

- **Frontend**: Vercel, `https://resilience-map-ai.vercel.app`. Git-connected to
  `main`, but auto-deploy-on-push has been unreliable in practice — after pushing,
  confirm a new deployment actually appears (`vercel ls`) rather than assuming the
  push alone was sufficient; `vercel deploy --prod` promotes manually if needed.
- **Backend**: Render, `https://resiliencemap-api.onrender.com` — a separate service,
  independent of Vercel, also auto-deploying from `main`. Free tier: spins down with
  inactivity, first request after idle can take 50s+ (Render's own dashboard
  banner says as much) — this is exactly why `dashboard-stats` is now cached
  same-origin on the frontend instead of hitting the backend on every load. Env
  vars (`DATABASE_URL`, `CRON_SECRET`, `ADMIN_SHARED_SECRET`, `QWEN_API_KEY`,
  `QWEN_BASE_URL`, `TOGETHER_API_KEY`, `DEEPSEEK_API_KEY`, etc.) are configured
  in the Render dashboard, not committed to the repo — see `backend/.env.example`
  for the full list including `QWEN_VISION_MODEL` and `FIRECRAWL_API_KEY`.
  Python version is pinned in
  `backend/runtime.txt` — do not remove it; Render's unpinned default silently
  moved to a version that broke SQLAlchemy's declarative mapping (see `7659823`)
  and cost real production downtime to diagnose.
- **Critical link**: the frontend's `NEXT_PUBLIC_API_URL` (Vercel env var) must point
  at the Render backend URL above. If it's ever empty/unset, the frontend silently
  falls back to same-origin relative API calls, which 404 — the map, dashboard, and
  AI features all break with no obvious error. This exact misconfiguration shipped
  unnoticed for 49+ days before being caught and fixed on 2026-08-01.
- **Vercel env vars**: `NEXT_PUBLIC_API_URL` (above), plus `OPENWEATHERMAP_API_KEY`
  (optional, server-only — powers `/weather`'s live tile layers; without it the
  page still renders with a notice instead of tiles). Set via
  `vercel env add <NAME> production` or the dashboard.

## AI provider routing

| Task | Preferred chain |
|---|---|
| Summaries / reports | Qwen → Together → DeepSeek → OpenAI → Gemini → local |
| Agent queries | Qwen → MiMo → Together → DeepSeek → OpenAI → Gemini → local |
| Structured reasoning | Qwen → Together → DeepSeek → OpenAI → Gemini → local |

Configure keys in `backend/.env.local`. The local fallback is always available —
`get_settings()` only *warns* (doesn't crash) in production if no provider key at
all is configured; an earlier version hard-required `DEEPSEEK_API_KEY`
specifically, which stopped making sense once Qwen/Together became primary.

- **Qwen** (`QWEN_API_KEY`, `QWEN_BASE_URL`) — Alibaba Cloud Model Studio/DashScope.
  Note: workspace-scoped API keys (from Model Studio's "Default Workspace" CSV
  export) use a per-workspace host, not the generic `dashscope-intl.aliyuncs.com`
  default — set `QWEN_BASE_URL` explicitly if so. Model Studio also supports
  fine-tuning Qwen3-32B/14B and Qwen3-VL-8B on custom data.
- **Qwen Vision** (`QWEN_VISION_MODEL`, default `qwen3-vl-flash`) — separate
  model slug used only by `POST /api/ai/spatial-vision`; shares
  `QWEN_API_KEY`/`QWEN_BASE_URL`. Verified against the live DashScope API
  during the 2026-08-06 audit — an earlier `qwen-vl-flash` default (no "3")
  returned "Model not exist"; `qwen3-vl-flash` is the current slug.
- **Together** (`TOGETHER_API_KEY`) — hosts open-weight models (Qwen, Llama, etc.)
  behind an OpenAI-compatible API with a managed fine-tuning API for the same
  checkpoints; no self-hosted inference server required.
- `/api/ai-provider-info` reports whichever provider will actually answer right
  now (resolved via the "agent" task chain, since that's what the AI Workspace
  chat uses) — it used to be hardcoded to always report "DeepSeek" regardless
  of configuration.

## Recent fixes (Aug 2026)

- **Dashboard latency**: root cause was the dashboard fetching `dashboard-stats`
  directly from the Render backend on every load — measured connection setup
  times of 3.0s → 1.0s → 0.07s across successive requests, the classic
  free-tier cold-start pattern (and once, a cold first request that took
  23.7s). Fixed with a same-origin cached proxy (`unstable_cache`, 60s
  window) so only the first request per window pays that cost.
- **Ambient globe inconsistent rendering**: `useWorldAtlas.ts` fetched its
  world-atlas data from `cdn.jsdelivr.net` on every mount with no fallback —
  if that request was slow, blocked, or failed, the globe silently didn't
  render at all. Now served from a local static asset
  (`frontend/public/countries-110m.json`); also made ~40% larger.
  **Follow-up (Aug 6, 2026)**: the local-asset fix above still fetched the
  file at runtime with `cache: "force-cache"`, which ignores the server's
  own `must-revalidate` and can pin a stale/failed response in the
  browser's HTTP cache indefinitely — reported as "globe only appears
  after a hard refresh." Fixed by removing the runtime fetch entirely: the
  topology JSON is now bundled directly as a JS module import
  (`frontend/components/globe/countries-110m.json`), eliminating the
  network/cache dependency outright. Separately hardened
  `next.config.ts` to send `Cache-Control: no-cache, no-store,
  must-revalidate` (+ legacy `Pragma`/`Expires`) on all page routes, so no
  browser/proxy (Opera's compression proxy was the specific concern) can
  ever serve a cached HTML shell referencing stale `_next/static` chunk
  hashes from a prior deployment — verified this doesn't affect
  `_next/static/*` (still `immutable`) or `/api/*`.
- **AI provider drift**: `/api/ai-provider-info` was hardcoded to always
  report `"DeepSeek"` regardless of what was actually configured or which
  provider would really answer a request — fixed to resolve dynamically via
  `pick_provider`. Separately, `get_settings()` used to hard-crash the entire
  backend at startup if `DEEPSEEK_API_KEY` was unset in production; this
  stopped making sense once other providers became primary, so it now only
  warns if no provider key at all is configured.
- **Shared quota protection**: the OpenWeatherMap proxy routes
  (`weather-tiles`, `weather-current`) had no rate limiting despite spending
  a shared, quota-capped key (60 calls/min, 1M/month free tier) — added
  best-effort per-client limiting (`frontend/lib/rateLimit.ts`). A follow-up
  code review then found the limiter itself had three bugs: both routes
  shared one bucket per client (panning the map could burn through
  precipitation's 300/min budget and then falsely 429 the unrelated 50/min
  current-conditions lookup), it trusted the client-spoofable first entry of
  `X-Forwarded-For` instead of the one Vercel's edge actually appends, and
  spent-out entries were never deleted from the in-memory Map. All three
  fixed — routes now use a namespaced key, trust the last `X-Forwarded-For`
  entry, and clean up empty entries.
- **Weather tiles read as "dull"**: OpenWeatherMap's free-tier tiles are
  genuinely pale/low-contrast for typical (non-extreme) readings — confirmed
  by downloading raw tiles directly. Fixed with MapLibre's native
  `raster-saturation`/`raster-contrast` paint properties, which make the same
  free data render as vividly as OWM's own reference map — no paid tier or
  new data source needed. Also added a `WeatherLegend` component (color
  gradient + min/max per layer) so values are interpretable at a glance.
- **Weather layer permanently stuck after the first tile source**: a more
  serious bug found while verifying the fix above — `map.isStyleLoaded()`
  looks like the right gate for "safe to addSource/addLayer" but actually
  returns false whenever *any* tile is mid-fetch, which is true almost
  constantly during normal panning. Gating every layer switch on it routed
  most switches through `map.once("load", applyLayer)` — but `"load"` is the
  map's one-time creation event; it fires once, ever. In practice: switch
  layers once on a fresh map and it works, pan at all and every subsequent
  layer click is silently discarded, leaving the map stuck on whichever
  layer's tiles loaded first regardless of which button is highlighted.
  Fixed with a ref set once by the map's real `"load"` event, used only to
  gate the very first call.
- Also fixed in the same pass: unescaped OpenWeatherMap response text was
  being interpolated directly into `Popup.setHTML()` (an HTML-injection
  surface driven by data the app doesn't control — now escaped), and
  `WeatherMap.tsx` was duplicating the exact dark-style tile URLs already
  defined in `lib/mapStyles.ts` (now imports `getMapStyle("dark")` instead).

## QA audit: Spatial Vision, hover telemetry, Firecrawl scraper (Aug 2026)

Full findings, evidence, and test results are in `AUDIT_REPORT.md`. Summary
of what changed while hardening the three features added in the prior
session:

- **Fixed**: telemetry card could unmount itself out from under the cursor
  before "Analyze with AI" registered a click (canvas `mouseleave` fired on
  entering the card, which sits on top of the canvas); pending debounced
  telemetry updates weren't cancelled on unmount (map.queryRenderedFeatures
  could run against an already-`map.remove()`'d map); no request
  cancellation, so a stale spatial-vision response could overwrite a newer
  one after a fast re-hover.
- **Fixed**: `/api/ai/spatial-vision` echoed raw provider error bodies back
  to the client, used a 20s timeout instead of the intended ~15s, and its
  output skipped the `validate_output()` guardrail every other AI endpoint
  runs through. Base64 image input wasn't validated (syntax, size, JPEG
  magic bytes) before reaching the provider.
- **Fixed**: `firecrawl_worker.py` called the *synchronous* `Firecrawl`
  client's blocking `scrape()` from inside an `async def` — would have
  stalled the event loop for every other request during a scrape. Switched
  to `AsyncFirecrawl`. Also added URL scheme validation, bounded
  exponential-backoff retry, and a DB rollback on failure (previously
  missing — a failed scrape could leave a dirty session for the next call).
- **Fixed**: `frontend/.env.local` was tracked in git (a non-standard
  `!.env.local` override in `frontend/.gitignore` opted it back in).
  Content was non-sensitive (only `NEXT_PUBLIC_*` feature flags, all
  matching `lib/feature-flags.ts`'s built-in defaults) but the pattern was
  fragile — reverted; `frontend/.env.example` added (previously missing).
- **Verified, not assumed**: `qwen-vl-flash` (the model slug used when this
  feature was first built) doesn't exist on DashScope — confirmed live
  against the real API — corrected to `qwen3-vl-flash`. The Firecrawl v2
  SDK shape (`formats=[{"type":"json","schema":...}]`, `result.json`) was
  re-verified by installing the actual package and inspecting its real
  types, not by re-trusting the original web-doc-sourced guess (which
  happened to be correct, but hadn't been checked against installed code).
- **Also hardened**: `RateLimitMiddleware`/`AuditLogMiddleware` switched
  from `request.url.path` to `request.scope["path"]` — the pinned
  `starlette==0.52.1` has published CVEs where a malformed `Host` header
  can desync the two, which could let a caller dodge the tighter AI-endpoint
  rate limit. `python-dotenv` bumped `1.0.0` → `1.2.2` (published CVE, not
  exploitable in this app's read-only usage, but a trivial safe patch).
- **Test coverage added**: 26 new backend tests (`test_spatial_vision.py`,
  `test_firecrawl_worker.py`) covering validation, timeout, error, rate
  limit, malformed-response, and successful-response paths for both
  features — all mocked, no real network calls.
- **Production verification (Aug 6, 2026, follow-up pass)**: the local-only
  audit above was pushed (`cd233b3`, then `2d7f678`) and verified live —
  Vercel build inspected via `vercel inspect --logs` (confirmed building
  `2d7f678`, clean TypeScript, 15/15 routes), Render `/health` returns
  `200 {"status":"ok"}`, and a production smoke test confirmed
  `/api/location-risk` and `/api/ai/spatial-vision` both return correct
  200/422 responses (no 500s) against `resiliencemapai.online` and
  `resiliencemap-api.onrender.com`. Full detail in `AUDIT_REPORT.md` §6.7.

## Dataset Management Enhancement (Aug 2026)

### Search Feature
The dataset management page now includes a full-text search bar that filters sources and
datasets in real-time across multiple fields:
- Source name and organization
- Coverage area and domain tags
- Dataset name, agency, and category
- Real-time result count display
- One-click clear (X button)

**Implementation**: `frontend/app/(app)/admin/datasets/page.tsx` lines 109-218

### Smart Refresh with Rate Limiting
Prevents accidental or malicious refresh spam that could overload backend services:
- **Rate limit**: Maximum 1 refresh per hour (configurable via `REFRESH_RATE_LIMIT_MS`)
- **Timestamp display**: Shows full date/time of last successful sync in user's local timezone
- **Time remaining**: Real-time countdown when rate limit is active (e.g., "Next refresh in 45m 30s")
- **Persistent state**: Refresh timestamp stored in browser localStorage, survives page reload
- **Tooltip feedback**: Disabled state shows rate limit status on hover

**Implementation**: `frontend/app/(app)/admin/datasets/page.tsx` lines 22-24, 103-176

### "What's New" Button
Transparency feature showing exactly what changed with each data sync:
- Toggle panel displays detailed update information
- Per-source details:
  - Source name and sync status (success/failed/partial)
  - Record count (formatted with thousands separator)
  - Exact timestamp of last successful sync
- Visual status indicators (✓ for success, ⚠ for warnings)
- Automatic diffing against previous sync state

**Implementation**: `frontend/app/(app)/admin/datasets/page.tsx` lines 283-324

### Resources Page Improvements
- **"Learn more" links** now functional, opening documentation in new browser tabs
- **"View Full Dataset" button** navigates directly to `/admin/datasets` page
- **Data Accuracy Notice** fully responsive, no text cutoff on mobile devices

**Implementation**: `frontend/app/(app)/resources/page.tsx` lines 163-171, 236-241, 245-258

## Disclaimer

Indicative risk intelligence derived from official public datasets (USGS, NOAA,
PAGASA, PHIVOLCS, Copernicus, World Bank). Not an official advisory, engineering
assessment, or disaster prediction system.
