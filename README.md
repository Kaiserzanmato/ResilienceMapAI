# ResilienceMap AI

ResilienceMap AI is a disaster-risk screening platform for location due diligence,
home-buyer research, insurers, developers, schools, and public-sector teams. It
combines global place search, an interactive multi-hazard map, evidence-aware
assessments, grounded AI explanations, and report/export workflows.

## Executive Summary

**Live application:** [resiliencemapai.online](https://resiliencemapai.online)

**Map:** [resiliencemapai.online/map](https://resiliencemapai.online/map)

**API health:** [resiliencemap-api.onrender.com/health](https://resiliencemap-api.onrender.com/health)

### Current Capabilities

- **Global map and search:** MapLibre-powered map with six basemaps, a 2D/3D
  globe projection toggle, risk zones, heatmaps, active alerts, historical
  events, coordinate search, server-side place search, and a
  nearest-evacuation-center locator with wayfinding cards and Google Maps
  directions.
- **Multi-hazard screening:** `POST /api/assessments` evaluates 13 hazard
  categories through the coverage registry. Unsupported evidence remains
  `null`; it is not represented as zero risk.
- **Flood auto-capture:** a user can flag a spot as flooding; the backend reads the newest
  Sentinel-1 radar scene (Sentinel-2 optical as the fallback) over a 5 km box, removes permanent
  water using the JRC Global Surface Water layer, and the map draws the result. The risk panel's
  Flood row shows it as satellite evidence with a score that joins the overall score; with no
  capture it says "No satellite capture yet: flag flooding here". It is satellite-observed, not an
  official flood map. See [docs/FLOOD_CAPTURE.md](docs/FLOOD_CAPTURE.md).
- **Wildfire and Volcanic scores:** the risk panel scores Wildfire from stored NASA FIRMS (VIIRS)
  active-fire detections within 10 km over the last 7 and 30 days (confidence and FRP weighted;
  satellite-observed active fire, not an official hazard map, and it includes agricultural burning), excluding
  any detection within 5 km of a known PH active volcano summit (Smithsonian GVP coordinates) as volcanic heat
  rather than wildfire. Freshness and history length come from FIRMS sync health, not the stored detections, so
  a pruned or recreated table can't reset either. Volcanic Activity scores the distance to the nearest
  Philippine volcano (danger-zone-style bands; **off by
  default and no volcano list is shipped**, because the Smithsonian GVP terms do not allow redistribution). Both
  feed the overall score when on; coverage gaps stay "No data" with a specific reason (not covered, no connected
  source, pending PHIVOLCS permission, or stale — see below). The PHIVOLCS alert level is not live (a link is shown). See [docs/WILDFIRE_VOLCANIC.md](docs/WILDFIRE_VOLCANIC.md).
- **Geocoding gateway:** Geoapify is the primary production provider,
  LocationIQ is the fallback, Photon is optional, and the local gazetteer is a
  degraded final fallback. Search candidates show their normalized addresses
  before a user selects one.
- **AI and reporting:** grounded summaries, a dedicated `/agents` AI workspace
  (glassmorphism UI, persona picker, grounding diagnostics), spatial map
  analysis, PDF/CSV export, and shareable report records. AI explains
  deterministic assessment data and does not override official advisories.
- **Data and operations:** source registry, scheduled-source sync interfaces,
  RBAC-ready dataset management, rate limits, quotas, audit logging, and
  Postgres/PostGIS persistence (Neon in production).
- **Security and AI guardrails:** server-only credentials, Pydantic request
  validation, prompt-injection detection, scope checks, approved-source
  grounding, output redaction, per-IP rate limits and usage quotas, restricted
  CORS, and validated spatial-vision image inputs.

### Production Architecture

```text
User
  |
  v
Next.js 16 / React 19 frontend on Vercel
  - MapLibre map, dashboard, reports, AI workspace, settings
  - https://resiliencemapai.online
  |
  | HTTPS: /api/geocode and /api/assessments
  v
FastAPI backend on Render
  - deterministic multi-hazard engine and coverage registry
  - AI provider abstraction, reports/exports, source registry
  - https://resiliencemap-api.onrender.com
  |
  +--> Geocoder gateway: Geoapify -> LocationIQ -> Photon (configured) -> local gazetteer
  +--> Hazard providers: global, national, and local source adapters
  +--> AI providers: Qwen -> Together -> DeepSeek -> OpenAI -> Gemini -> local fallback
  +--> Neon PostgreSQL/PostGIS via DATABASE_URL (Alembic, head 0009); in-memory repositories otherwise
  +--> Flood capture: Sentinel-1/2 scenes (Planetary Computer, Earth Search) + JRC permanent water
  GitHub Actions (every 2 h) --> /api/cron/sync-sources and /api/cron/flood-captures
```

### Framework And Integration Stack

| Layer | Current implementation |
|---|---|
| Frontend | Next.js 16.3.0, React 19.2.4, TypeScript, Tailwind CSS v4, TanStack Query |
| Mapping and charts | MapLibre GL, GeoJSON, Recharts, d3-geo, Framer Motion |
| Backend | FastAPI 0.128.8, Pydantic 2.13.4, HTTPX 0.28.1, ReportLab |
| Deployment | GitHub `main` -> Vercel frontend and Render FastAPI service |
| Data | Coverage registry, GDACS, NASA EONET, NASA FIRMS, USGS, ReliefWeb, Sentinel-1/2 flood captures, Neon PostgreSQL/PostGIS |
| AI | Qwen, Together, DeepSeek, OpenAI, Gemini, deterministic local fallback |
| Geocoding | Geoapify primary, LocationIQ fallback, optional Photon, local gazetteer fallback |

### Important Limitations

Global place search is not address verification. Provider coverage varies, and
private-property or venue queries can produce broad or unrelated candidates.
Verify the displayed address and coordinates before using an assessment. Hazard
coverage also varies by country and provider; a `null` result means no evidence
is available, not a low-risk result. See
[`TECHNICAL_DOCUMENTATION.md`](TECHNICAL_DOCUMENTATION.md) and
[`RELEASE_AUDIT_2026-08-07.md`](RELEASE_AUDIT_2026-08-07.md) for the live
contract, deployment evidence, and release limitations.

A hazard row with no score always says specifically why, never a generic "unavailable": **"Not covered by
current sources"** (no provider is registered for this hazard/country at all), **"No connected source yet"**
(a provider is registered but nothing is wired up to read it), **"Pending PHIVOLCS data permission"** (Volcanic
specifically, while `ENABLE_VOLCANIC_SCORING` is off), or **"Data stale"** (a connector exists but its data is
too old to score). See the reason-code table in [`ARCHITECTURE.md`](ARCHITECTURE.md).

The Flood row in the risk panel is **satellite-observed, not an official flood map**: it comes
from a user-flagged Sentinel capture, is reduced for scene age, capped when permanent water could
not be removed, and exists only where someone has flagged. The permanent-water data (JRC) ends in
2021. The Render free tier sleeps when idle (the first request can take 50 s or more). See
[`docs/OPERATIONS.md`](docs/OPERATIONS.md) (Known limits).

## Architecture Overview

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

### Local development (database)

Local and CI runs use their own Neon branch (endpoint `ep-empty-dawn-b3d11zgg`), never the
production one (`ep-orange-glitter-b3r4smzw`). Put its `DATABASE_URL` (pooled) and
`ALEMBIC_DATABASE_URL` (direct/non-pooled — DDL should not go through a transaction pooler)
in `backend/.env.local` (git-ignored; not `.env` — see `backend/.env.example`). `app/config.py`
refuses to start whenever `ENVIRONMENT` isn't `production` and `DATABASE_URL` resolves to the
production endpoint, so a stale copy-pasted connection string can't quietly point a local run at
production data.

Bring the local branch up to date with the latest schema:

```bash
cd backend && .venv/bin/python -m alembic upgrade head   # uses ALEMBIC_DATABASE_URL from .env.local
.venv/bin/python -m alembic current                      # should print "0009 (head)"
```

Production migrations are applied separately, out-of-band — see [docs/OPERATIONS.md](docs/OPERATIONS.md).

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
cd frontend && npm test && npx tsc --noEmit && npm run lint
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
  the pinned `starlette` (see `backend/requirements.txt`) and can be desynced from the actual routed
  path by a malformed header (PYSEC-2026-161/248), which could otherwise let
  a caller dodge the tighter AI-endpoint rate limit
- Long-window usage quotas, separate from the burst rate limiter above
  (`app/services/usage_quota.py`, per-IP): Insights is capped at 3
  generations per 5h; the AI Agent panel and AI Workspace chat share one
  daily budget (`CHAT_QUOTA_LIMIT`, default 20; resets at UTC midnight). `GET /api/usage-status` reports
  current usage without consuming a hit — it drives the usage meters shown
  in the UI next to each of those three features.
- Audit logging on all `/api` routes
- RBAC-ready role model (`public_user` → `super_admin`); dataset mutation requires `dataset_admin`
- CORS restricted to the listed frontend origins (`CORS_ORIGINS`: apex, www and the Vercel domain)
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
real authentication (JWT/OAuth) is not yet built. The frontend never holds
this secret directly: `frontend/app/api/admin/datasets/upload/route.ts` is a
server-side proxy that holds it — the proxy only attaches it to the backend
request after the caller first proves they know the secret themselves (an
`x-admin-key` header, checked with a constant-time comparison); it does not
attach the secret on behalf of every caller (see
`RELEASE_AUDIT_2026-09-22.md` for the audit that found and fixed the
previous behavior, where it did).

## Data sync & persistence

Five sources have real connectors and are wired into scheduled sync: GDACS,
NASA EONET, NASA FIRMS, USGS Earthquake and ReliefWeb (`backend/app/data_sources/`).
The registry (`sources_registry.py`) also lists other approved sources — most
without a connector yet, registered for discoverability, not sync
(`GET /api/source-registry`, `GET /api/sync-health`).

- **Scheduling**: `.github/workflows/sync-sources.yml` runs every 2 hours
  (and on demand with `gh workflow run sync-sources.yml`). It calls
  `GET /api/cron/sync-sources` (only sources that are due are fetched) and
  `GET /api/cron/flood-captures` (finishes flood jobs left unfinished when the free
  Render instance slept), authenticated by the `CRON_SECRET` repository secret, which
  must equal the Render `CRON_SECRET`. The run reports each source's status and record
  count; a source whose credential is missing reports `not_configured` rather than
  pretending it synced. `render.yaml` (Render cron) and `vercel.json` (daily Vercel cron)
  are optional alternatives and not needed. `POST /api/data-sync` (RBAC-gated) triggers the
  same dispatch manually. If `CRON_SECRET` isn't set the app still starts (it logs a
  warning) but the cron routes return 403 (the earlier crash-on-missing-secret outage:
  commit `b18f89b`, whose real cause was `sqlalchemy==2.0.36` on Python 3.14, fixed in
  `7659823` with the pinned `backend/runtime.txt`).
- **ReliefWeb** uses the v2 API: `RELIEFWEB_APPNAME` (an appname ReliefWeb approved) is sent
  as the `appname` query parameter, and the request asks for `description` (`body` is not
  a valid `/disasters` field and returns HTTP 400). **NASA FIRMS** needs `NASA_FIRMS_MAP_KEY`.
- **Persistence**: sync health, the sync audit log, uploaded-dataset metadata,
  shareable reports and the flood tables live behind a repository interface
  (`backend/app/repositories/`) with two implementations — in-memory
  (state is lost on every restart) and Postgres-backed, selected
  automatically by whether `DATABASE_URL` is set. Production uses **Neon Postgres
  with PostGIS**; with `ENVIRONMENT=production` the API refuses to start without
  `DATABASE_URL` unless `ALLOW_EPHEMERAL_STATE=true`.
- **Migrations**: Alembic (`backend/alembic/`, head `0009`), applied out-of-band from a
  trusted machine against the direct, non-pooled connection string in
  `ALEMBIC_DATABASE_URL` — never inside the API, never automatically on Render startup or as a build
  step. The safe procedure and rollback are in
  [docs/OPERATIONS.md](docs/OPERATIONS.md). Revisions: `0001` base tables, `0002`
  `hazard_events`, `0004` dataset governance, `0005` PostGIS, `0006` flood capture, `0007`
  total/flood hectares (permanent water excluded), `0008` FIRMS fire detections (the wildfire score),
  `0009` `sync_health.first_successful_sync_at` (wildfire history/freshness, survives pruned or
  recreated detection rows — must be applied before the code that reads it deploys).

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

## External dependencies

Volcanic Activity shows "No data" until PHIVOLCS grants permission to use its volcano data; `ENABLE_VOLCANIC_SCORING` stays `false`.
Tracked in [issue #34](https://github.com/Kaiserzanmato/ResilienceMapAI/issues/34) with the status of the other external sources (ReliefWeb, NASA FIRMS, Sentinel, JRC). Details:
[docs/WILDFIRE_VOLCANIC.md](./docs/WILDFIRE_VOLCANIC.md).

## Deployment

- **Frontend**: Vercel, `https://resiliencemapai.online` (with the Vercel
  project domain as a secondary alias). Git-connected to
  `main`, but auto-deploy-on-push has been unreliable in practice — after pushing,
  confirm a new deployment actually appears (`vercel ls`) rather than assuming the
  push alone was sufficient; `vercel deploy --prod` promotes manually if needed.
- **Backend**: Render, `https://resiliencemap-api.onrender.com` — a separate service,
  independent of Vercel, also auto-deploying from `main`. Free tier: spins down with
  inactivity, first request after idle can take 50s+ (Render's own dashboard
  banner says as much) — this is exactly why `dashboard-stats` is now cached
  same-origin on the frontend instead of hitting the backend on every load. Env
  vars (`DATABASE_URL`, `CRON_SECRET`, `ADMIN_SHARED_SECRET`, `CORS_ORIGINS`,
  `RELIEFWEB_APPNAME`, `QWEN_API_KEY`, etc.) are configured in the Render
  dashboard, not committed to the repo. [docs/ENVIRONMENT.md](docs/ENVIRONMENT.md)
  lists every variable by name, purpose and secret-vs-config; `backend/.env.example`
  has the same names with safe defaults. Day-two procedures (manual sync, migrations,
  rollback, known limits) are in [docs/OPERATIONS.md](docs/OPERATIONS.md).
  Python version is pinned in
  `backend/runtime.txt` — do not remove it; Render's unpinned default silently
  moved to a version that broke SQLAlchemy's declarative mapping (see `7659823`)
  and cost real production downtime to diagnose.
- **Critical link**: the frontend's `NEXT_PUBLIC_API_URL` (Vercel env var) must point
  at the Render backend URL above. If it's ever empty/unset, the frontend silently
  falls back to `http://localhost:8000`, so every API call fails — the map, dashboard, and
  AI features all break with no obvious error. This exact misconfiguration shipped
  unnoticed for 49+ days before being caught and fixed on 2026-08-01.
- **Vercel env vars**: `NEXT_PUBLIC_API_URL` (above),
  `NEXT_PUBLIC_CARTO_BASEMAP_API_KEY` (public CARTO basemap key for dark/light
  and hybrid-label tiles — required to avoid CARTO's API-key watermark), plus
  `NEXT_PUBLIC_ENABLE_FLOOD_CAPTURE` (shows the flood layer and flag button; pair it
  with the backend `ENABLE_FLOOD_CAPTURE`), plus
  `OPENWEATHERMAP_API_KEY` (optional, server-only — powers `/weather`'s live
  tile layers; without it the page still renders with a notice instead of
  tiles). Set via `vercel env add <NAME> production` or the dashboard.

## Global Search And Multi-Hazard Screening

The map search calls the Render backend's `GET /api/geocode` endpoint. Its
provider gateway uses Geoapify first, LocationIQ when the primary provider
returns no results or fails, optional Photon when configured, then the small
local gazetteer as a degraded fallback. Results use one normalized schema
(`name`, `formatted_address`, country, coordinates, geometry type, and
provider). The chooser displays the normalized address so users can verify a
candidate before selecting it for assessment.

`POST /api/assessments` routes a selected coordinate through the coverage
registry and returns 13 hazard records with source and confidence metadata.
`null` means no evidence is available; it is never converted to a zero-risk
score. An overall score is emitted only when at least two hazard scores are
numeric.

This is screening intelligence, not address verification. Provider coverage
varies by place and region: property-style queries can return a nearby, broad,
or unrelated candidate. Users must verify the full displayed address and
coordinates before relying on a result. See
[`TECHNICAL_DOCUMENTATION.md`](TECHNICAL_DOCUMENTATION.md) and
[`RELEASE_AUDIT_2026-08-07.md`](RELEASE_AUDIT_2026-08-07.md) for the current
contract, production evidence, and limitations.

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

## Apple-style glass design pass, unified line icons, single persona picker (Oct 2026)

Reworked the UI onto a consistent "Apple glass" design system (frontend only,
no backend changes):

- **Design tokens** (`frontend/app/globals.css`): glass surfaces at
  `--glass-blur: 22px` / `--glass-saturate: 1.8` via the shared `.glass` /
  `.glass-strong` classes, a 12/16/22px radius scale, an iOS-style spring
  motion curve (`--motion-spring`) for menus/sheets/dialogs, a `--press-scale`
  button-press token, and accessibility fallbacks for
  `prefers-reduced-transparency` and browsers without `backdrop-filter` (both
  drop straight to an opaque `--surface-solid`, never leaving text on an
  unreadable background).
- **Shared components** (`frontend/components/ui/`): `GlassMenu` (header
  dropdowns, replacing duplicated menu markup in `PersonaSelector` and
  `ThemeToggle` — outside-click + Escape to close, `role="menu"`) and
  `GlassSheet` (mobile bottom sheet for panels under 768px — `dvh`-capped,
  `env(safe-area-inset-bottom)` padding; wired into `InsightsPanel`).
  `GlassPanel` now builds on the same `.glass-strong` class as everything
  else instead of its own one-off Tailwind blur stack.
- **Icons**: every emoji and mixed icon set in the UI was replaced with
  `lucide-react` (no SF Symbols — their licence excludes web use). A shared
  `Icon` wrapper (`components/ui/Icon.tsx`) standardizes 1.5px stroke,
  `currentColor`, and 20px/18px sizing; `IconTile` wraps a menu row's icon in
  the 32px rounded-square glass tile (accent-tinted when selected) used by
  the persona menu. Persona icons: Citizen=House, Real Estate=Building2,
  Insurance/Fintech=ShieldCheck, Government=Landmark, NGO=HandHeart,
  Business=Briefcase, School=GraduationCap
  (`components/persona-icons.tsx`). Hazard rows in the risk panel now show a
  colour-blind-safe icon per hazard (`components/hazard-icons.tsx`) —
  colour alone no longer carries the risk level. The map's evacuation-center
  markers are raw MapLibre DOM nodes, not React, so they inline a literal
  `<svg>` matching lucide's `life-buoy` icon rather than rendering a
  component.
- **Settings**: removed the duplicate "Default persona" card — it read and
  wrote the same persisted store as the header's Insight Persona dropdown,
  which is now the only place to change persona. Settings shows the current
  persona as read-only text with a pointer to the header menu.

See `ARCHITECTURE.md`'s Styling section for the full token/component
reference.

## Evacuation Center Locator & security hardening (Sep 2026)

Added the nearest-evacuation-center locator (see Current Capabilities above).
In the same release, a full security audit (`code-reviews` skill; see
`RELEASE_AUDIT_2026-09-22.md`) found and fixed a live-reproducible
Critical: the dataset-upload admin proxy was attaching `ADMIN_SHARED_SECRET`
to every caller regardless of who they were, letting any anonymous visitor
write into the dataset source registry through the public `/admin/datasets`
page. Also patched two Critical unauthenticated-RCE CVEs in `next`
(16.3.0→16.3.5) plus High CVEs in `nanoid` and `sharp`, closed a latent
unsanitized-HTML popup sink in the map's alert/event markers, and added
`robots.txt`/`sitemap.xml`/`llms.txt` plus baseline security response
headers. See the audit doc for the two items deliberately deferred (the
`maplibre-gl` major-version bump, and the `/api/reports` public-listing
access-model decision).

## AI workspace redesign & shimmer/panel fixes (Sep 2026)

Reworked the `/agents` AI workspace with a glassmorphism visual language
(`GlassPanel`, `GlassmorphismCta`), removed the duplicate AI drawer that used
to render alongside the page's own chat surface, and added the 2D/3D globe
projection toggle to `LayerControlWidget`. A cloud multi-agent review
(`code-review ultra`) of that change then caught:

- **Search dropdown clipped on the Location context panel**: `GlassPanel`
  hardcoded `overflow-hidden` on its outer wrapper (unlike the `GlassCard` it
  replaced), which clipped the `SearchBar` autocomplete dropdown at the
  panel's bottom edge once results appeared. Fixed by overriding to
  `overflow-visible` on the one panel that hosts `SearchBar`; the other
  panels keep the clip for their rounded-corner look.
- **Shimmer CTA silently not rendering**: `GlassmorphismCta`'s conic-gradient
  used `calc(270deg-(var(--spread)*0.5))` — invalid CSS per the values spec,
  since `+`/`-` inside `calc()` require surrounding whitespace. Every
  browser dropped the whole background declaration, so the "Run Risk Audit"
  CTA's signature rotating shimmer never rendered. Fixed to
  `calc(270deg_-_(var(--spread)*0.5))` (Tailwind maps `_` to a literal
  space).
- **Border-beam animation desynced from `speed` prop**: the inner sweep span
  hardcoded a `4s` duration instead of `var(--speed)`, so a caller passing a
  custom `speed` would see the two overlaid animations drift apart. Also
  fixed a `style` prop spread ordering bug where a caller-supplied `style`
  would silently replace (not merge with) the internal CSS custom
  properties driving both animations, and added `hc:hidden` to the
  decorative shimmer/beam layers to match this same PR's High Contrast
  precedent on `GlassPanel`'s inner highlight border.
- **AI drawer state reset on route change**: `AIAgentPanel` was being
  conditionally unmounted on `/agents` routes to avoid showing a duplicate
  of the page's own chat surface. That dropped any unsent draft in the
  drawer's input and re-fired its usage-status fetch on every round trip.
  Fixed by keeping it always mounted and hiding it via a `hidden` prop
  instead of unmount/remount.
- Two additional reuse nits: the mobile "Run Risk Audit" button now reuses
  the page's existing `canAudit` boolean instead of re-deriving it inline,
  and `LayerControlWidget`'s map-view/projection radio groups now share one
  `RadioPill` component instead of duplicating the selected/unselected
  styling twice.

## Recent fixes (Aug 2026)

- **Risk summary overlay had no scroll**: `RiskSummaryWidget.tsx` (the
  hazard-score panel shown after clicking a location on `/map`) rendered all
  13 hazard rows plus main drivers, nearest-zone stats, and the action-button
  row in one unconstrained-height card. On shorter viewports the bottom of
  the panel — including the Insights/Ask AI/Export/Share buttons — was
  pushed off-screen with no way to reach it. Fixed by capping the card to
  `min(640px, viewport − header/footer chrome)`, pinning the title/badge
  header and the action-button footer outside the scroll region, and making
  only the hazard list + main drivers + nearest-zone section scroll
  (`overflow-y-auto`). Also added a `.scroll-visible` utility
  (`frontend/app/globals.css`) with an opaque thumb and visible track so the
  scrollbar itself doesn't disappear into the dark theme — the prior
  site-wide thin scrollbar was easy to miss. Verified live on
  `resiliencemapai.online` post-deploy by diffing the deployed CSS/JS
  bundles for the `.scroll-visible` rule and the `overflow-y-auto` hazard
  container.
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
