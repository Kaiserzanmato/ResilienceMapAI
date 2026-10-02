# Operations

**Current as of:** 2026-10-02. Production is the Vercel frontend (`https://resiliencemapai.online`, also
`www` and `https://resilience-map-ai.vercel.app`), the Render API (`https://resiliencemap-api.onrender.com`),
Neon Postgres with PostGIS, and a GitHub Actions schedule. Variables are listed in
[ENVIRONMENT.md](./ENVIRONMENT.md).

## What runs where

| Piece | Where | Notes |
|---|---|---|
| Frontend | Vercel, root `frontend`, auto-deploy from `main` | `NEXT_PUBLIC_*` values are inlined at build time |
| API | Render web service `resiliencemap-api`, auto-deploy from `main` | Free tier: sleeps when idle |
| Database | Neon Postgres with PostGIS | Schema managed only by Alembic, repo head `0008`; production is at `0007` until `0008` is applied |
| Scheduler | GitHub Actions `.github/workflows/sync-sources.yml`, every 6 hours (`0 */6 * * *`) plus manual runs | Calls the two cron routes with `CRON_SECRET` |

The scheduled workflow calls `GET /api/cron/sync-sources` (refreshes every source that is due) and
`GET /api/cron/flood-captures` (finishes flood jobs left unfinished, for example when the instance slept
mid-job). Each retries once after 60 s if it gets a 5xx or no answer, and it keeps the free instance from
sitting asleep for long. `render.yaml` still declares an optional Render cron job (every 15 minutes) and
`vercel.json` a daily Vercel cron; GitHub Actions is the schedule that is documented and verified here, so
do not enable a second scheduler without a reason (sources only fetch when due, so a duplicate is harmless
but wasteful).

### Data sources in the sync

Five sources have connectors and are wired into the sync: `gdacs`, `nasa-eonet`, `nasa-firms`,
`usgs-earthquake` and `reliefweb`. Each run reports one result per source: `success` with a record count,
`failed` with a closed reason code (for example `upstream_http_error`), or `not_configured` when its
credential is missing (`NASA_FIRMS_MAP_KEY`, `RELIEFWEB_APPNAME`). ReliefWeb uses the v2 API with an approved
appname sent as the `appname` query parameter; the request asks for the `description` field (`body` is not a
valid field on `/disasters` and gets HTTP 400).

## Trigger a sync manually

With the GitHub CLI (never prints the secret, which stays in the repo secret):

```bash
gh workflow run sync-sources.yml
gh run watch "$(gh run list --workflow=sync-sources.yml --limit 1 --json databaseId -q '.[0].databaseId')"
gh run view <run-id> --log | grep '"source_id"'      # per-source status and record counts
```

Healthy output lists all five sources as `success`. A `403` means `CRON_SECRET` differs between the repo secret and
the Render variable. A first call after idle can take about 50 seconds while Render wakes.

To call the route yourself, keep the secret in an environment variable and out of shell history and logs:

```bash
curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://resiliencemap-api.onrender.com/api/cron/sync-sources
```

## Run a production migration safely

Migrations run **out of band from a trusted machine**, never inside the API process. Production was at `0007` when `0008` (FIRMS
detections) was added; this is the procedure for any migration.

1. **Read the migration first.** Look at the SQL it will run: `cd backend && alembic upgrade <from>:<to> --sql`
   (offline; connects to nothing). Prefer additive, nullable changes. Know its rollback before you start.
2. **Back up or branch.** In Neon, create a branch (or note a restore point) of the production database.
3. **Use the direct (non-pooled) connection string**, the one whose host has no `-pooler`. DDL through a
   transaction pooler can misbehave. Put it in `ALEMBIC_DATABASE_URL` for the one command only; Alembic prefers
   it over `DATABASE_URL`.
4. **Keep the URL out of the terminal and out of chat.** Copy the string to the clipboard and read it inside the
   command, for example `ALEMBIC_DATABASE_URL="$(pbpaste)" alembic current`, and redact the command's output (the
   URL contains the password). Do not paste it into an issue, a PR, a prompt or a log. Check it without printing it,
   for example that it starts with `postgresql://`, the host ends in `neon.tech` and does not contain `-pooler`.
5. **Check, run, check.**
   ```bash
   cd backend
   ALEMBIC_DATABASE_URL="$(pbpaste)" alembic current          # expect the previous revision
   ALEMBIC_DATABASE_URL="$(pbpaste)" alembic upgrade head
   ALEMBIC_DATABASE_URL="$(pbpaste)" alembic current          # expect the new head, shown as "(head)"
   ```
6. **Deploy in a safe order.** Additive migrations (new nullable columns, as in 0007) are safe before or after the code
   deploy. For anything that renames or drops, deploy code that works with both shapes first.
7. **Clear the clipboard** (copy something harmless) and verify the app: `/health`, then the feature the migration is for.

Rollback is `alembic downgrade <previous>`. Read the `downgrade()` first:

* `0007 -> 0006` drops `flood_extents.total_water_ha` and `flood_ha` (the permanent-water numbers; nothing else is lost).
* `0006 -> 0005` **drops the flood tables and every flag, job and extent in them.** Do not run it on production unless that is intended.

The test `tests/test_postgres_config.py` pins the migration chain; update it when you add a revision.

## Roll back a deploy

A deploy rollback does not touch the database. If the new code needs a migration, see the migration rollback above.

* **Render (API):** dashboard, service `resiliencemap-api`, **Events** or **Deploys**, pick the last good deploy and
  **Rollback**. Or push a revert commit to `main` (preferred: it keeps `main` and production in step). Then check
  `GET /health` and `GET /api/flood/extents` (or any route you changed).
* **Vercel (frontend):** dashboard, **Deployments**, open the last good production deployment and **Promote to Production**
  (or `vercel rollback` / `vercel promote <deployment-url>`). Remember the `NEXT_PUBLIC_*` values are baked into each build.
* **Never force-push `main`.** Revert with a new commit and let both hosts redeploy.
* If only a flag misbehaves, switch the feature off instead: set `ENABLE_FLOOD_CAPTURE=false` on Render (the `/api/flood/*`
  routes return 404 and the cron drain does nothing) and `NEXT_PUBLIC_ENABLE_FLOOD_CAPTURE=false` on Vercel plus a redeploy.

## Wildfire and Volcanic scores

* **Migration 0008 first.** The FIRMS sync now stores detections in `fire_detections`; run `alembic upgrade head` (the procedure
  above) **before** the code deploy that reads it. Until then the FIRMS source reports a failed sync and the Wildfire row stays "no data"
  (an assessment never fails over it).
* **History fills over time.** The 6-hourly sync stores each day it downloads, so the 7 and 30 day windows fill by themselves. To fill
  them at once: `cd backend && NASA_FIRMS_MAP_KEY=... NASA_FIRMS_AREA=... .venv/bin/python scripts/backfill_firms.py --days 30`
  (dry run), then add `DATABASE_URL=...` and `--apply`. Keep the key and URL out of shell history and logs.
* **`NASA_FIRMS_AREA` is the wildfire coverage.** A point outside that box (or `world`) is "outside coverage", not "no fire". Use a
  box that includes the Philippines, e.g. `116,4,127,22`. Rows older than 35 days are pruned at each sync.
* A Wildfire score of zero is shown only with at least 7 days of history; before that the row says so instead of reassuring.
* Volcanic scoring is **off by default and ships no data**: GVP's terms allow non-commercial use only and the repo is public, so the list
  was removed. The row stays "no data" until a list with usable terms is supplied via `VOLCANO_DATA_FILE` and
  `ENABLE_VOLCANIC_SCORING=true`. Details: [WILDFIRE_VOLCANIC.md](./WILDFIRE_VOLCANIC.md).

## Flood capture, day to day

* Jobs live in the database. A job stuck in `running` past its lease (`FLOOD_LEASE_SECONDS`, 300 s) is reclaimed by the next
  `flood-captures` call; after `FLOOD_MAX_ATTEMPTS` it becomes `failed` with a reason code.
* A flag creates a capture only if the API receives the `POST /api/flood/flags`. If a click seems to do nothing, check the
  browser Network tab: a CORS failure (origin not in `CORS_ORIGINS`) sends no POST. The flag button now says whether anything was
  sent.
* Extents captured before migration 0007, or whose JRC fetch failed, have no `flood_ha` and are shown as unfiltered. The next flag in
  the same 0.025 degree cell recaptures them with the permanent-water filter.
* Per-IP limits (3 flags per hour; usage quotas) need `CLIENT_IP_HEADER=x-forwarded-for` behind Render, otherwise every visitor
  shares one bucket. See [ENVIRONMENT.md](./ENVIRONMENT.md).

## Known limits

* **The flood score is satellite-observed, not official.** The risk panel's Flood row scores the share of the 5 km box that a
  Sentinel scene shows under water, reduced for scene age (full weight to 7 days, falling to a quarter at 30 days; older than
  30 days is shown but not scored) and capped at 60 when permanent water could not be removed. It is labelled "satellite-observed,
  not an official flood map" and is not a modelled return period, a forecast or an advisory. It maps open surface water: radar misses
  flooding under dense vegetation or in built-up areas, can mistake smooth dry surfaces for water, and optical scenes are limited
  by cloud. The weights are judgement, defined as constants in `frontend/lib/flood-indicator.ts`.
* **Permanent-water filter data ends in 2021** (JRC Global Surface Water), so water bodies created since, such as new fishponds or
  reservoirs, are not excluded.
* **The Render free tier sleeps** when idle: the first request after a quiet period can take 50 seconds or more, and the scheduled
  sync has to wake it. Do not read a slow first request as an outage.
* **Overall risk is a mean of the hazards that have data**, and the panel states how many ("3 of 13"). Hazards without a verified
  source stay "unavailable"; they are never counted as zero. Scored today: earthquake, flood (where a capture covers the spot) and wildfire
  (where FIRMS data is stored). Volcanic activity is off until a licensed volcano list is supplied.
* **A flood capture exists only where someone has flagged**, and a spot with none says "No satellite capture yet: flag flooding here".
* Rate limiting is per instance (in-memory), so it resets on restart and does not span instances.
* Search and assessment coverage is uneven by region; no-data is expected for unsupported hazard and location pairs.
