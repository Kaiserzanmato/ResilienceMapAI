# Technical Documentation

**Current as of:** 2026-10-02

**Scope:** deployed application contracts and implementation boundaries.

## Stack and deployment

- Frontend: Next.js 16.3.0, React 19.2.4, TypeScript, Tailwind CSS, MapLibre.
  It is deployed by Vercel at `https://resiliencemapai.online`.
- Backend: FastAPI 0.128.8, Pydantic 2.13.4, HTTPX 0.28.1. It is deployed by
  Render at `https://resiliencemap-api.onrender.com`.
- Persistence is repository-backed. Production uses Neon Postgres with PostGIS through `DATABASE_URL`,
  with the schema managed by Alembic (head `0007`: base tables, `hazard_events`, dataset governance,
  PostGIS, flood capture, permanent-water columns). Without `DATABASE_URL` the repositories fall back to
  memory, which is not durable across restarts; production refuses to start that way unless
  `ALLOW_EPHEMERAL_STATE=true`.
- Source sync: GitHub Actions calls `GET /api/cron/sync-sources` every 6 hours (Bearer `CRON_SECRET`). Five
  sources are wired: GDACS, NASA EONET, NASA FIRMS, USGS Earthquake and ReliefWeb (v2 API, approved
  `RELIEFWEB_APPNAME`). The same workflow drains flood-capture jobs via `GET /api/cron/flood-captures`.
- Flood auto-capture (`backend/app/flood/`, `/api/flood/*`): a user flag queues a job that reads the newest
  Sentinel-1 radar scene (Sentinel-2 optical as the fallback) over a 5 km box, subtracts permanent water using
  the JRC Global Surface Water occurrence layer (default threshold 75%), and stores the flood polygons and
  `total_water_ha` / `flood_ha`. See [docs/FLOOD_CAPTURE.md](docs/FLOOD_CAPTURE.md).
- Risk panel: the registry-driven assessment has no flood connector, so the frontend scores the Flood row from
  the capture covering the clicked spot (`frontend/lib/flood-indicator.ts`) and recomputes Overall and the hazard
  count; with no capture the row says "No satellite capture yet: flag flooding here". It is satellite-observed,
  not an official flood map.

GitHub `main` drives both services. Frontend changes require a Vercel Ready
deployment; backend changes require a Render deployment and a `/health` smoke
test. Roll back by redeploying a known-good deployment or a revert commit through the relevant
provider; do not force-push production history. Procedures: [docs/OPERATIONS.md](docs/OPERATIONS.md).
The browser origins the API accepts are set in `CORS_ORIGINS` (apex, `www` and the Vercel domain).

## Map search and assessment flow

```text
Map search input
  -> GET /api/geocode?q=<query>
  -> Geoapify -> LocationIQ -> Photon (when configured) -> local gazetteer
  -> user selects an explicitly displayed candidate
  -> POST /api/assessments
  -> coverage registry -> provider adapters -> deterministic assessment
  -> map, insights, report and export consumers
```

`GET /api/geocode` accepts 1-80 characters at the HTTP boundary; provider
search starts at `GEOCODER_MIN_QUERY_LENGTH` (default 3). It returns:

```json
{
  "query": "Tokyo Station, Japan",
  "provider": "geoapify",
  "fallback_used": false,
  "degraded": false,
  "cached": false,
  "provider_status": { "geoapify": "success" },
  "results": [{ "name": "Tokyo Station", "formatted_address": "...", "latitude": 35.681619, "longitude": 139.7653303 }]
}
```

Diagnostics disclose provider outcome categories only: `success`, `no-result`,
`not-configured`, `authentication-error`, `rate-limited`, `http-error`,
`timeout`, or `network-error`. They never disclose credential values or
credential-bearing request URLs. Successful results are cached by normalized
query and result limit for `GEOCODER_CACHE_TTL_SECONDS` (default 300 seconds).
Requests use the bounded `GEOCODER_TIMEOUT_SECONDS` value (default 3 seconds).
There is no retry loop, preventing provider amplification.

`POST /api/assessments` accepts a coordinate, optional name and country code,
and geometry type. The response contains 13 hazard entries, evidence/source
metadata, and nullable score/confidence fields. `null` is an explicit no-data
state. The aggregate score is also `null` unless two or more hazard scores are
available. No endpoint claims uniform global hazard coverage.

## Risk summary overlay

`components/map/RiskSummaryWidget.tsx` caps its own height to
`min(640px, viewport − nav/banner/footer chrome − 32px)`. The header (title,
coordinates, badge, close) and footer (action buttons, export menu, usage
meter, disclaimer) are `shrink-0`; only the hazard list / main-drivers /
nearest-zone block between them scrolls (`overflow-y-auto`), using the
`.scroll-visible` class in `app/globals.css` for a non-default, visible
scrollbar. This keeps the action buttons reachable on short viewports
without requiring the browser window to be resized.

## Configuration

Set server-side only in Render or local backend `.env`; examples are in
`backend/.env.example`. The complete catalogue (every Render, Vercel and GitHub variable, with purpose
and secret vs config) is [docs/ENVIRONMENT.md](docs/ENVIRONMENT.md).

| Purpose | Variables |
|---|---|
| Geocoder gateway | `GEOCODER_PROVIDER`, `GEOAPIFY_API_KEY`, `GEOAPIFY_BASE_URL`, `LOCATIONIQ_ACCESS_TOKEN`, `LOCATIONIQ_BASE_URL`, `PHOTON_URL` |
| Geocoder controls | `GEOCODER_TIMEOUT_SECONDS`, `GEOCODER_MAX_RESULTS`, `GEOCODER_CACHE_TTL_SECONDS`, `GEOCODER_MIN_QUERY_LENGTH`, `GEOCODER_ENABLE_FALLBACK` |
| Frontend/backend link | `NEXT_PUBLIC_API_URL` (Vercel) |
| Persistence | `DATABASE_URL`, `ALEMBIC_DATABASE_URL`, `REDIS_URL` |
| Browser access | `CORS_ORIGINS` (apex, www, vercel) |
| Source sync | `CRON_SECRET` (also a GitHub secret), `RELIEFWEB_APPNAME`, `NASA_FIRMS_MAP_KEY`, `NASA_FIRMS_AREA` |
| Flood capture | `ENABLE_FLOOD_CAPTURE`, `FLOOD_*` (incl. `FLOOD_PERMANENT_WATER_THRESHOLD`), `CLIENT_IP_HEADER`, `CLIENT_IP_TRUSTED_HOPS`; frontend `NEXT_PUBLIC_ENABLE_FLOOD_CAPTURE` |
| AI and operational controls | `QWEN_*`, `TOGETHER_*`, `DEEPSEEK_*`, `OPENAI_API_KEY`, `GEMINI_API_KEY`, rate-limit and quota variables |
| Admin/RBAC stopgap | `ADMIN_SHARED_SECRET` (backend and frontend, same value) — required for `/admin/datasets` dataset registration; the frontend proxy (`frontend/app/api/admin/datasets/upload/route.ts`) only forwards it after the caller presents it back via `x-admin-key` |

Keys, tokens, and shared secrets must never be committed, returned by API
diagnostics, or copied into documentation.

## Local validation

```bash
cd frontend && npm run lint && npx tsc --noEmit && npm run build
cd backend && .venv/bin/python -m pytest tests/ -q
cd .. && bash scripts/audit-secrets.sh
```

Frontend unit tests run with `cd frontend && npm test` (Node's built-in runner). Python formatter, linter,
type checker, and dependency-audit commands are not configured in this
repository; their absence must be reported rather than inferred as a pass.

## Operational limitations

- Geoapify and fallback-provider search is place-data dependent. A result list
  can include broad or unrelated matches, especially for private properties.
  Users must confirm the displayed address and coordinates before assessment.
- LocationIQ fallback requires a valid configured token and is only exercised
  when the primary provider fails or returns no results.
- Render free instances sleep after inactivity; the first request can take 50 s or more.
- The flood score is satellite-observed, not an official flood map, and the permanent-water filter's data
  (JRC) ends in 2021.
- The current assessment registry has uneven regional/provider coverage;
  no-data is expected for unsupported hazard/location combinations.
- Scalable distributed rate limiting needs infrastructure beyond the per-instance in-memory limiter
  (`REDIS_URL` is reserved for it).
