# Technical Documentation

**Current as of:** 2026-08-07

**Scope:** deployed application contracts and implementation boundaries.

## Stack and deployment

- Frontend: Next.js 16.3.0, React 19.2.4, TypeScript, Tailwind CSS, MapLibre.
  It is deployed by Vercel at `https://resiliencemapai.online`.
- Backend: FastAPI 0.128.8, Pydantic 2.13.4, HTTPX 0.28.1. It is deployed by
  Render at `https://resiliencemap-api.onrender.com`.
- Persistence is repository-backed. Postgres/PostGIS is optional through
  `DATABASE_URL`; in-memory fallback data is not durable across backend restarts.

GitHub `main` drives both services. Frontend changes require a Vercel Ready
deployment; backend changes require a Render deployment and a `/health` smoke
test. Roll back by redeploying a known-good GitHub commit through the relevant
provider; do not force-push production history.

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

## Configuration

Set server-side only in Render or local backend `.env`; examples are in
`backend/.env.example`.

| Purpose | Variables |
|---|---|
| Geocoder gateway | `GEOCODER_PROVIDER`, `GEOAPIFY_API_KEY`, `GEOAPIFY_BASE_URL`, `LOCATIONIQ_ACCESS_TOKEN`, `LOCATIONIQ_BASE_URL`, `PHOTON_URL` |
| Geocoder controls | `GEOCODER_TIMEOUT_SECONDS`, `GEOCODER_MAX_RESULTS`, `GEOCODER_CACHE_TTL_SECONDS`, `GEOCODER_MIN_QUERY_LENGTH`, `GEOCODER_ENABLE_FALLBACK` |
| Frontend/backend link | `NEXT_PUBLIC_API_URL` (Vercel) |
| Persistence | `DATABASE_URL`, `ALEMBIC_DATABASE_URL`, `REDIS_URL` |
| AI and operational controls | `QWEN_*`, `TOGETHER_*`, `DEEPSEEK_*`, `OPENAI_API_KEY`, `GEMINI_API_KEY`, rate-limit and quota variables |

Keys, tokens, and shared secrets must never be committed, returned by API
diagnostics, or copied into documentation.

## Local validation

```bash
cd frontend && npm run lint && npx tsc --noEmit && npm run build
cd backend && .venv/bin/python -m pytest tests/ -q
cd .. && bash scripts/audit-secrets.sh
```

There is no configured frontend `npm test` script. Python formatter, linter,
type checker, and dependency-audit commands are not configured in this
repository; their absence must be reported rather than inferred as a pass.

## Operational limitations

- Geoapify and fallback-provider search is place-data dependent. A result list
  can include broad or unrelated matches, especially for private properties.
  Users must confirm the displayed address and coordinates before assessment.
- LocationIQ fallback requires a valid configured token and is only exercised
  when the primary provider fails or returns no results.
- Render free instances can cold-start after inactivity.
- The current assessment registry has uneven regional/provider coverage;
  no-data is expected for unsupported hazard/location combinations.
- Postgres/PostGIS-backed persistence and scalable distributed rate limiting
  require production infrastructure configuration beyond the in-memory default.
