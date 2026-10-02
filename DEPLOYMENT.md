# ResilienceMap AI — Deployment Guide

This is a two-service app: a **Next.js frontend** (deploys to Vercel) and a
**FastAPI backend** (deploys to any Python host — Render, Railway, Fly.io).
Vercel cannot run the FastAPI server inside this Next.js project, so the
backend is deployed separately and connected via one environment variable.

## 1. Local development

```bash
# Backend
cd backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn app.main:app --reload --port 8000

# Frontend (new terminal)
cd frontend
npm ci
npm run dev          # http://localhost:3000
```

## 2. Tests, lint, type-check, production build

```bash
cd backend  && .venv/bin/python -m pytest tests/ -q
cd frontend && npm test && npx tsc --noEmit && npm run lint && npm run build
```

## 3. Push to GitHub

```bash
cd "/Users/oliveripsioco/Downloads/ResilienceMap AI Web Application"
git init
git add .
git commit -m "ResilienceMap AI — initial import"
git branch -M main
git remote add origin https://github.com/Kaiserzanmato/ResilienceMapAI.git
git push -u origin main
```

## 4. Deploy the backend first (Render example)

Create a Web Service from the same repo with:
- **Root directory:** `backend`
- **Build command:** `pip install -r requirements.txt`
- **Start command:** `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- **Environment variables:** at least `ENVIRONMENT=production`, `DATABASE_URL`, `CRON_SECRET`,
  `ADMIN_SHARED_SECRET` and `CORS_ORIGINS` (below). AI keys (`QWEN_API_KEY`, `DEEPSEEK_API_KEY`,
  `TOGETHER_API_KEY`, …) are all optional; the deterministic local AI fallback works with zero keys.
  Every variable, with its purpose and whether it is a secret, is in
  [docs/ENVIRONMENT.md](docs/ENVIRONMENT.md). Never commit values.
- **`CORS_ORIGINS`** must list every browser origin that serves the app, comma-separated. Production:
  `https://resiliencemapai.online`, `https://www.resiliencemapai.online` and
  `https://resilience-map-ai.vercel.app`. A missing origin fails the CORS preflight (HTTP 400) and that host
  cannot reach the API at all.
- **`CLIENT_IP_HEADER=x-forwarded-for`** is recommended on Render: behind its proxy every visitor otherwise shares
  one address, so the per-IP usage quotas and the flood-flag limit would act on everyone together.

Note the resulting URL, e.g. `https://resiliencemap-api.onrender.com`.

### Scheduled source sync and durable state

Live sources only refresh when something calls `GET /api/cron/sync-sources` with
`Authorization: Bearer $CRON_SECRET`. Only sources that are *due* (their own `sync_frequency_minutes`
has elapsed) are fetched.

- **GitHub Actions is the production scheduler.** `.github/workflows/sync-sources.yml` runs every 6 hours
  (`0 */6 * * *`) and on demand (`gh workflow run sync-sources.yml`). It calls the source sync and
  `GET /api/cron/flood-captures` (finishes flood jobs left unfinished when the free instance slept), retries
  once after 60 s, and keeps the instance from idling for long. Set the **`CRON_SECRET` repository secret**
  (Settings, Secrets and variables, Actions) to the same value as the Render `CRON_SECRET`.
- **Five sources are wired:** `gdacs`, `nasa-eonet`, `nasa-firms`, `usgs-earthquake` and `reliefweb`.
  `NASA_FIRMS_MAP_KEY` (optional `NASA_FIRMS_AREA`) and `RELIEFWEB_APPNAME` (an appname ReliefWeb approved, sent as the
  `appname` query parameter on the v2 API) enable the last two; without them a source reports `not_configured`
  instead of pretending it synced.
- **Other schedulers (optional, not needed):** `render.yaml` declares a Render cron job (`*/15 * * * *`) for the same
  endpoint, and `vercel.json` a daily Vercel cron at `/_/backend/api/cron/sync-sources` (sub-daily needs Vercel
  Pro; `/_/backend/*` currently 404s on the production domain, so it does nothing today). Running more than one is
  harmless, since only due sources fetch.
- **Durable state: Neon Postgres with PostGIS.** Set `DATABASE_URL` and apply the schema with Alembic
  (`alembic upgrade head`, currently revision `0007`). With `ENVIRONMENT=production` the API refuses to
  start without `DATABASE_URL` unless `ALLOW_EPHEMERAL_STATE=true`. Migrations run from a trusted machine
  against the direct (non-pooled) string in `ALEMBIC_DATABASE_URL`, never inside the API; the safe procedure
  is in [docs/OPERATIONS.md](docs/OPERATIONS.md).
- **Flood auto-capture** is off until `ENABLE_FLOOD_CAPTURE=true` on Render and
  `NEXT_PUBLIC_ENABLE_FLOOD_CAPTURE=true` on Vercel (and migration 0006 or later is applied). It needs the raster
  packages in `requirements.txt` and works within the 512 MB free instance. See [docs/FLOOD_CAPTURE.md](docs/FLOOD_CAPTURE.md).

## 5. Deploy the frontend to Vercel

**Dashboard route** (matches the import screen you have open):
- **Root Directory:** set to `frontend` — not `./` (click Edit next to Root Directory)
- **Application Preset:** Next.js (auto-detected once the root is `frontend`)
- Build/Output/Install commands: leave defaults
- **Environment variable:** `NEXT_PUBLIC_API_URL = https://<your-backend-url>`
- **Environment variable (optional):** `NEXT_PUBLIC_ENABLE_FLOOD_CAPTURE = true` shows the flood layer, the flag
  button and the Flood row's satellite evidence; set it only together with the backend `ENABLE_FLOOD_CAPTURE`.
  `NEXT_PUBLIC_*` values are inlined at build time, so changing one needs a new deployment. All frontend
  variables are in [docs/ENVIRONMENT.md](docs/ENVIRONMENT.md).
- **Environment variable (optional):** `OPENWEATHERMAP_API_KEY` — powers the
  live tile layers on the **Weather Map Forecast** tab (free tier, sign up at
  https://openweathermap.org/api). Server-only — never exposed to the
  browser. Without it the page still renders with a notice instead of tiles.
- Click **Deploy**

**CLI route:**
```bash
cd "/Users/oliveripsioco/Downloads/ResilienceMap AI Web Application/frontend"
vercel link                                  # link to your Vercel account/project
vercel env add NEXT_PUBLIC_API_URL production   # paste the backend URL when prompted
vercel env add OPENWEATHERMAP_API_KEY production # optional — free key from openweathermap.org
vercel --prod                                # public production deployment
```

## 6. After both are live

Make sure the backend's `CORS_ORIGINS` lists the origins above (the apex, `www` and the Vercel domain),
redeploy the backend, and verify, including a preflight from each origin (it must return 200):

```bash
curl https://<backend-url>/health
curl -s -o /dev/null -w "%{http_code}\n" -X OPTIONS https://<backend-url>/api/flood/flags \
  -H "Origin: https://www.resiliencemapai.online" -H "Access-Control-Request-Method: POST"
open https://<your-app>.vercel.app/map
```

Day-two procedures (manual sync, production migrations, rollbacks, known limits) are in
[docs/OPERATIONS.md](docs/OPERATIONS.md).

## Known production notes

- Persistence follows `DATABASE_URL`: with Neon set, sync health, the audit log and the flood tables are durable;
  without it the repositories fall back to memory and reset on restart.
- The Render free tier sleeps when idle; the first request after a quiet period can take 50 s or more.
- The Flood score in the risk panel is satellite-observed, not an official flood map (see
  [docs/OPERATIONS.md](docs/OPERATIONS.md), Known limits).
- Rate limiting is per-instance (in-memory sliding window). Behind a
  multi-instance deployment, move it to Redis.
