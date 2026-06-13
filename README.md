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
