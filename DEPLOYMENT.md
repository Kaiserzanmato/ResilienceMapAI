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
cd backend  && .venv/bin/python -m pytest tests/ -q   # 17 tests
cd frontend && npx tsc --noEmit && npm run lint && npm run build
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
- **Environment variables:** `CORS_ORIGINS=https://<your-app>.vercel.app`
  plus any AI keys (`QWEN_API_KEY`, `DEEPSEEK_API_KEY`, …) — all optional;
  the deterministic local AI fallback works with zero keys.

Note the resulting URL, e.g. `https://resiliencemap-api.onrender.com`.

## 5. Deploy the frontend to Vercel

**Dashboard route** (matches the import screen you have open):
- **Root Directory:** set to `frontend` — not `./` (click Edit next to Root Directory)
- **Application Preset:** Next.js (auto-detected once the root is `frontend`)
- Build/Output/Install commands: leave defaults
- **Environment variable:** `NEXT_PUBLIC_API_URL = https://<your-backend-url>`
- Click **Deploy**

**CLI route:**
```bash
cd "/Users/oliveripsioco/Downloads/ResilienceMap AI Web Application/frontend"
vercel link                                  # link to your Vercel account/project
vercel env add NEXT_PUBLIC_API_URL production   # paste the backend URL when prompted
vercel --prod                                # public production deployment
```

## 6. After both are live

Update the backend's `CORS_ORIGINS` to the final Vercel production domain
(comma-separated if you also want preview deployments), redeploy the backend,
and verify:

```bash
curl https://<backend-url>/health
open https://<your-app>.vercel.app/map
```

## Known production notes

- Report share-links and registered datasets are stored in memory (MVP scope);
  they reset when the backend restarts. Add PostgreSQL/PostGIS + Redis when
  persistence is needed — the config is already structured for it.
- Rate limiting is per-instance (in-memory sliding window). Behind a
  multi-instance deployment, move it to Redis.
