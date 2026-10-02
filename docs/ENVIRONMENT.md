# Environment variables

**Current as of:** 2026-10-02. Names, purposes and defaults come from
`backend/app/config.py`, `backend/app/client_ip.py`, `backend/alembic/env.py`,
`frontend/lib/feature-flags.ts`, the frontend `process.env` reads and
`.github/workflows/sync-sources.yml`. The `.env.example` files list the same names.

**Never write real values** in this repo, in docs, in PRs or in chat. Secrets live only in the
host dashboards (Render, Vercel, GitHub) and in your local, git-ignored `.env.local`.

**Secret vs config.** *Secret*: leaks grant access or cost money; set it in the dashboard, rotate
it if exposed, never log it. *Config*: a toggle, limit, URL or identifier; safe to appear in
docs and `.env.example` (as a default or blank). *Public*: shipped to the browser by design
(`NEXT_PUBLIC_*`), so never put a secret in one.

Where each variable is set:

| Host | What runs there |
|---|---|
| **Render** (`resiliencemap-api`) | the FastAPI backend: every variable in the backend tables |
| **Vercel** (project `resilience-map-ai`, root `frontend`) | the Next.js frontend: the frontend table |
| **GitHub** (repo Actions secrets) | `CRON_SECRET`, used by `.github/workflows/sync-sources.yml` |
| **Your machine** | `ALEMBIC_DATABASE_URL` for a production migration (see [OPERATIONS.md](./OPERATIONS.md)) |

A `NEXT_PUBLIC_*` variable is inlined at **build** time, so changing it needs a new Vercel deployment.
A Render variable change restarts the service.

## Backend (Render)

### Core and security

| Name | Purpose | Kind | Default |
|---|---|---|---|
| `ENVIRONMENT` | `production` turns on the start-up checks below | config | `development` |
| `CORS_ORIGINS` | Comma-separated browser origins the API accepts. Production needs the apex, `www` and the Vercel domain (see below) | config | `http://localhost:3000,http://127.0.0.1:3000` |
| `DATABASE_URL` | Postgres connection string (Neon, with PostGIS). Unset = in-memory repositories (lost on restart). Required when `ENVIRONMENT=production` | **secret** | unset |
| `ALLOW_EPHEMERAL_STATE` | `true` lets production start without `DATABASE_URL`; use only knowingly | config | `false` |
| `CRON_SECRET` | Bearer secret for `/api/cron/sync-sources` and `/api/cron/flood-captures`. Unset = those routes return 403. Must equal the GitHub repo secret of the same name | **secret** | unset |
| `ADMIN_SHARED_SECRET` | RBAC stopgap for admin dataset actions (not real authentication). Same value as the Vercel one | **secret** | unset |
| `REDIS_URL` | Reserved for distributed rate limiting; not required | **secret** (may embed a password) | unset |

`CORS_ORIGINS` for production is exactly these three entries, comma-separated, no spaces
needed:

```
https://resiliencemapai.online,https://www.resiliencemapai.online,https://resilience-map-ai.vercel.app
```

A browser origin that is not listed fails the preflight (`OPTIONS` returns 400) and the app
cannot call the API from that host at all. Only `GET` and `POST` are allowed.

### Source sync

| Name | Purpose | Kind | Default |
|---|---|---|---|
| `RELIEFWEB_APPNAME` | The appname ReliefWeb approved for this app, sent as the `appname` query parameter on the v2 API. Unset = the source reports `not_configured` | config (an identifier, not a credential) | unset |
| `NASA_FIRMS_MAP_KEY` | NASA FIRMS key. Unset = the source is skipped, never recorded as synced | **secret** | unset |
| `NASA_FIRMS_AREA` | `world` or a `west,south,east,north` box to keep the download small | config | `world` |
| `ENABLE_REALTIME_EVENTS` | Master switch for the current-events feed (`/api/events`) | config | `false` |
| `ENABLE_USGS_EVENTS`, `ENABLE_GDACS_EVENTS`, `ENABLE_EONET_ENRICHMENT`, `ENABLE_RELIEFWEB_ENRICHMENT` | Per-provider switches for that feed | config | `true` |
| `EVENTS_CACHE_TTL_SECONDS` | Events cache lifetime | config | `300` |
| `EVENTS_MAX_RESPONSE_BYTES` | Cap on a provider response | config | `2097152` |
| `FIRECRAWL_API_KEY` | Advisory scraper; no-ops when unset | **secret** | unset |
| `FIRECRAWL_ALLOWED_HOSTS` | Hosts the scraper may fetch | config | PAGASA, PHIVOLCS, NDRRMC, JMA |

GDACS, NASA EONET and USGS need no key.

### Risk-panel scores

| Name | Purpose | Kind | Default |
|---|---|---|---|
| `ENABLE_WILDFIRE_SCORING` | Score Wildfire from stored FIRMS detections (needs migration 0008; without data the row stays no-data) | config | `true` |
| `ENABLE_VOLCANIC_SCORING` | Score Volcanic Activity from distance to Philippine volcanoes. Off by default: no volcano list ships in the repo (GVP terms do not allow redistribution) | config | `false` |
| `VOLCANO_DATA_FILE` | Path to a volcano list JSON outside the repo (format in [WILDFIRE_VOLCANIC.md](./WILDFIRE_VOLCANIC.md)). Unset, missing or invalid: Volcanic stays no-data | config (a path) | unset |

### Flood auto-capture

| Name | Purpose | Kind | Default |
|---|---|---|---|
| `ENABLE_FLOOD_CAPTURE` | Master switch. While `false`, every `/api/flood/*` route returns 404 and the cron drain is a no-op. Needs migration 0006 or later | config | `false` |
| `FLOOD_FLAGS_PER_HOUR` | Flags one client may create per hour (429 after that) | config | `3` |
| `FLOOD_AOI_KM` | Side of the square capture box; areas over 100 km2 are refused | config | `5` |
| `FLOOD_PERMANENT_WATER_THRESHOLD` | JRC occurrence percent at or above which water counts as permanent and is subtracted. Outside 1 to 100 falls back to 75 | config | `75` |
| `FLOOD_SCENE_WINDOW_DAYS` | How far back to look for a Sentinel scene | config | `12` |
| `FLOOD_MAX_ATTEMPTS` | Attempts before a job is `failed` | config | `3` |
| `FLOOD_LEASE_SECONDS` | A claimed job's lease; an expired lease means the instance died mid-job | config | `300` |
| `FLOOD_INLINE_PROCESSING` | Start the capture right after the 202 (best effort; the cron drain picks up leftovers) | config | `true` |
| `FLOOD_CRON_BUDGET_SECONDS` | Time budget of one cron drain | config | `90` |
| `FLOOD_HASH_SALT` | Pepper for the HMAC of client IPs (only the HMAC is stored). Falls back to `CRON_SECRET` if unset | **secret** | unset |

### Client attribution (per-IP limits)

| Name | Purpose | Kind | Default |
|---|---|---|---|
| `CLIENT_IP_HEADER` | Header that carries the real client address, e.g. `x-forwarded-for`. Behind Render's proxy every visitor shares the proxy address unless this is set, so per-IP limits (usage quotas, flood flags) then act on everyone together. Only set it when the service really is behind that proxy: a direct caller controls the header | config | unset (socket peer) |
| `CLIENT_IP_TRUSTED_HOPS` | How many proxies append an entry; the client is that many entries from the right (spoofed prefixes are ignored) | config | `1` |
| `FLOOD_CLIENT_IP_HEADER` | Older name for `CLIENT_IP_HEADER`; kept as a fallback | config | unset |

### Rate limits and quotas

| Name | Purpose | Kind | Default |
|---|---|---|---|
| `RATE_LIMIT_REQUESTS`, `RATE_LIMIT_WINDOW` | Burst limiter: requests per window (seconds), per IP | config | `120`, `60` |
| `AI_RATE_LIMIT_REQUESTS` | Burst limit for AI routes | config | `20` |
| `INSIGHTS_QUOTA_LIMIT`, `INSIGHTS_QUOTA_WINDOW` | Insights generations per sliding window (seconds) | config | `3`, `18000` |
| `CHAT_QUOTA_LIMIT` | AI chat messages per day (resets at UTC midnight) | config | `20` |

### AI providers (all optional; a deterministic local fallback runs with none)

| Name | Purpose | Kind | Default |
|---|---|---|---|
| `QWEN_API_KEY`, `QWEN_BASE_URL`, `QWEN_MODEL`, `QWEN_VISION_MODEL` | Qwen (DashScope); the vision model serves `/api/ai/spatial-vision` | key **secret**, rest config | model `qwen-plus`, vision `qwen3-vl-flash` |
| `TOGETHER_API_KEY`, `TOGETHER_BASE_URL`, `TOGETHER_MODEL` | Together AI | key **secret**, rest config | `Qwen/Qwen2.5-72B-Instruct-Turbo` |
| `DEEPSEEK_API_KEY`, `DEEPSEEK_BASE_URL`, `DEEPSEEK_MODEL` | DeepSeek | key **secret**, rest config | `deepseek-chat` |
| `MIMO_API_KEY`, `MIMO_BASE_URL`, `MIMO_MODEL` | Xiaomi MiMo | key **secret**, rest config | `mimo-7b-rl` |
| `OPENAI_API_KEY`, `OPENAI_BASE_URL`, `OPENAI_MODEL` | OpenAI | key **secret**, rest config | `gpt-4o-mini` |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | Gemini | key **secret**, model config | `gemini-2.0-flash` |

### Geocoding

| Name | Purpose | Kind | Default |
|---|---|---|---|
| `GEOCODER_PROVIDER` | Primary provider | config | `geoapify` |
| `GEOAPIFY_API_KEY`, `LOCATIONIQ_ACCESS_TOKEN` | Provider credentials | **secret** | unset |
| `GEOAPIFY_BASE_URL`, `LOCATIONIQ_BASE_URL`, `PHOTON_URL` | Provider endpoints (Photon is self-hosted) | config | provider defaults / unset |
| `GEOCODER_TIMEOUT_SECONDS`, `GEOCODER_MAX_RESULTS`, `GEOCODER_CACHE_TTL_SECONDS`, `GEOCODER_MIN_QUERY_LENGTH`, `GEOCODER_ENABLE_FALLBACK` | Gateway controls | config | `3`, `8`, `300`, `3`, `true` |

### Managed by Render, not set by hand

`PORT` (the start command binds to it). The Python version is pinned in `backend/runtime.txt`
(do not remove it; an unpinned default once broke the build).

## Frontend (Vercel)

| Name | Purpose | Kind |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | Base URL of the API, e.g. the Render service URL. If missing the app falls back to `http://localhost:8000` and every API call fails | public config |
| `NEXT_PUBLIC_ENABLE_FLOOD_CAPTURE` | Shows the flood layer, the flag button and the Flood evidence in the risk panel. Default `false`; turn on together with the backend `ENABLE_FLOOD_CAPTURE` | public config |
| `NEXT_PUBLIC_CARTO_BASEMAP_API_KEY` | CARTO basemap key; it is visible in the browser by design, so restrict it by domain at CARTO | public config |
| `NEXT_PUBLIC_ENABLE_GLOBAL_SOURCE_REGISTRY` | Source registry views | public config (default `true`) |
| `NEXT_PUBLIC_ENABLE_SOURCE_AUTO_SYNC` | Auto-sync controls in the datasets UI | public config (default `true`) |
| `NEXT_PUBLIC_ENABLE_SOURCE_HEALTH_MONITORING` | Source health display | public config (default `true`) |
| `NEXT_PUBLIC_ENABLE_SYNC_AUDIT_LOGS` | Sync audit log display | public config (default `true`) |
| `NEXT_PUBLIC_ENABLE_HUMANITARIAN_LAYER` | Humanitarian layer | public config (default `true`) |
| `NEXT_PUBLIC_ENABLE_DEEPSEEK_GROUNDED_CONTEXT` | Grounded-context option for the AI panels | public config (default `true`) |
| `NEXT_PUBLIC_ENABLE_HOME_GLOBE_LOADER` | Globe loader on the home page | public config (default `true`) |
| `NEXT_PUBLIC_ENABLE_CONFLICT_SECURITY_LAYER` | Conflict/security layer; connectors not validated | public config (default `false`) |
| `NEXT_PUBLIC_ENABLE_AVIATION_LAYER` | Aviation layer; connectors not validated | public config (default `false`) |
| `NEXT_PUBLIC_ENABLE_MARITIME_LAYER` | Maritime layer; connectors not validated | public config (default `false`) |
| `NEXT_PUBLIC_ENABLE_REALTIME_EVENTS` | Current-events UI; pair with the backend `ENABLE_REALTIME_EVENTS` | public config (default `false`) |
| `OPENWEATHERMAP_API_KEY` | Weather tile layers, read only by a server route; never sent to the browser. Without it the page shows a notice instead of tiles | **secret** |
| `ADMIN_SHARED_SECRET` | Same value as the backend; the admin upload proxy forwards it only after the caller presents it | **secret** |

Flags are read by their literal `NEXT_PUBLIC_*` name (a dynamic lookup is not inlined by Next.js and silently
stays at the default; this is what PR #25 fixed).

## GitHub Actions

| Name | Purpose | Kind |
|---|---|---|
| `CRON_SECRET` (repository secret) | Sent as `Authorization: Bearer` by the scheduled sync. Must equal the Render `CRON_SECRET`. If it is missing the workflow fails with a clear error | **secret** |

## Start-up checks (`ENVIRONMENT=production`)

The backend refuses to start without `DATABASE_URL` (unless `ALLOW_EPHEMERAL_STATE=true`), and warns
loudly when no AI key or no `CRON_SECRET` is set (a missing `CRON_SECRET` makes the cron routes return 403).
