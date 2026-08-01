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
- **Dashboard** (`/dashboard`) — executive KPI cards + interactive charts
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
  except `/map` (`frontend/components/globe/AmbientGlobe.tsx`), built on the existing
  `d3-geo`/`d3-timer`/`topojson-client` stack (no new dependency). Theme-reactive,
  respects `prefers-reduced-motion`, pauses when the tab is backgrounded, hidden on
  small viewports.

## Security

- All AI calls server-side; no keys in the browser
- Pydantic input validation on every endpoint; output redaction
- Prompt-injection detection (flagged input is treated as data, not instructions)
- Sliding-window rate limiting (tighter budget for AI endpoints)
- Audit logging on all `/api` routes
- RBAC-ready role model (`public_user` → `super_admin`); dataset mutation requires `dataset_admin`
- CORS restricted to the frontend origin

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
  inactivity, first request after idle can take 50s+. Env vars (`DATABASE_URL`,
  `CRON_SECRET`, `ADMIN_SHARED_SECRET`, `DEEPSEEK_API_KEY`, etc.) are configured in
  the Render dashboard, not committed to the repo. Python version is pinned in
  `backend/runtime.txt` — do not remove it; Render's unpinned default silently
  moved to a version that broke SQLAlchemy's declarative mapping (see `7659823`)
  and cost real production downtime to diagnose.
- **Critical link**: the frontend's `NEXT_PUBLIC_API_URL` (Vercel env var) must point
  at the Render backend URL above. If it's ever empty/unset, the frontend silently
  falls back to same-origin relative API calls, which 404 — the map, dashboard, and
  AI features all break with no obvious error. This exact misconfiguration shipped
  unnoticed for 49+ days before being caught and fixed on 2026-08-01.

## AI provider routing

| Task | Preferred chain |
|---|---|
| Summaries / reports / personas | Qwen → DeepSeek → OpenAI → Gemini → local |
| Agent queries | MiMo → DeepSeek → Qwen → OpenAI → Gemini → local |
| Structured reasoning | DeepSeek → Qwen → OpenAI → Gemini → local |

Configure keys in `backend/.env`. The local fallback is always available.

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
