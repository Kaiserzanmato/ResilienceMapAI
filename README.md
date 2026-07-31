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
- **Datasets** (`/admin/datasets`) — source provenance + metadata-validated registration (RBAC)
- **Settings** (`/settings`) — theme (light/dark/system/high-contrast), persona, map defaults

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
  `GET /api/cron/sync-sources` every 15 minutes, authenticated by
  `CRON_SECRET` (required in production — the app refuses to start without
  it there). `POST /api/data-sync` (RBAC-gated) triggers the same dispatch
  manually.
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

## AI provider routing

| Task | Preferred chain |
|---|---|
| Summaries / reports / personas | Qwen → DeepSeek → OpenAI → Gemini → local |
| Agent queries | MiMo → DeepSeek → Qwen → OpenAI → Gemini → local |
| Structured reasoning | DeepSeek → Qwen → OpenAI → Gemini → local |

Configure keys in `backend/.env`. The local fallback is always available.

## Disclaimer

Indicative risk intelligence derived from official public datasets (USGS, NOAA,
PAGASA, PHIVOLCS, Copernicus, World Bank). Not an official advisory, engineering
assessment, or disaster prediction system.
