# Changelog

All notable changes to ResilienceMap AI are logged here, newest first. This
file starts from 2026-08-08 (entries for #22 to #30 were added 2026-10-02 from
the merged PRs); for full history before that, see `git log` and
the narrative "Recent fixes" section in `README.md`, which already covers
the Aug 6–7 geocoding-gateway and dashboard/globe/weather work in detail.

Format: `[commit] type: summary`, followed by what changed and why when it
isn't obvious from the summary alone.

## 2026-10-02

- **[#30] fix: risk panel scores Flood from the satellite capture.** The Flood row existed but was
  "Temporarily unavailable": no flood connector is configured in the registry and the capture was only read by a
  separate evidence block shown when the Flood layer was active, so it never reached the row, Overall or the
  hazard count. The row is now always shown: with a capture it carries satellite evidence (scene date, flood ha,
  permanent water excluded, share of the box) and a score (share of the 5 km box, times a recency weight; stale
  after 30 days; capped at 60 when unfiltered) that joins Overall ("2 of 13"); with none it says "No satellite
  capture yet: flag flooding here". Flood is first with the Flood layer, rows sort by score with Overall Risk.
  Labelled satellite-observed, not an official flood map. `frontend/lib/flood-indicator.ts`.
- **[#29] fix: flood flag button explains failures.** Distinct messages for rate limit, 404, server error and
  "request never answered", plus a hint under the button when the spot already has a capture.
- **[#28] fix: ReliefWeb sync.** The v2 `/disasters` API returns HTTP 400 for the field `body`; the connector and
  normalizer now use `description`. ReliefWeb needs the approved appname (`RELIEFWEB_APPNAME`).
- **[#27] feat: exclude permanent water from flood extents.** JRC Global Surface Water occurrence at or above
  `FLOOD_PERMANENT_WATER_THRESHOLD` (default 75) is subtracted, clipped to the capture box; if the JRC fetch
  fails the extent is stored unfiltered. Alembic `0007` adds nullable `total_water_ha` and `flood_ha`;
  `/api/flood/*` returns `total_water_ha`, `flood_ha`, `permanent_water_filtered`. Extents without `flood_ha`
  are recaptured on the next flag. Candaba (S1 2026-09-19): 1,224.5 ha open water, 1,187.2 ha flooding, 31.1 ha
  permanent water excluded.
- **Production:** migrated to `0007`; `CORS_ORIGINS` accepts the apex, `www` and the Vercel domain (preflight returns 200 from each).
- **Docs:** new `docs/ENVIRONMENT.md` and `docs/OPERATIONS.md`; README, DEPLOYMENT, DEPLOYMENT_GUIDE, TECHNICAL_DOCUMENTATION,
  ARCHITECTURE, FLOOD_CAPTURE, RUNBOOK_INTEGRATIONS, DOCUMENTATION_INDEX and both `.env.example` files brought up to date.

## 2026-10-01

- **[#22] feat: Postgres + PostGIS persistence (Neon).** Repositories pick Postgres when `DATABASE_URL` is set;
  Alembic migrations (`0001` to `0005`), applied out of band against the direct connection string
  (`ALEMBIC_DATABASE_URL`).
- **[#23] feat: scheduled source sync.** `.github/workflows/sync-sources.yml` runs every 6 hours and calls
  `/api/cron/sync-sources` and `/api/cron/flood-captures` with the `CRON_SECRET` repo secret. Five sources are
  wired: GDACS, NASA EONET, NASA FIRMS, USGS Earthquake, ReliefWeb. Fixes for GDACS, ReliefWeb v2 and FIRMS.
- **[#24] feat: flood auto-capture.** `POST /api/flood/flags` queues a job; the worker reads the newest Sentinel-1
  scene (Sentinel-2 as the fallback) over a 5 km box and stores the water polygons in PostGIS (Alembic `0006`).
  3 flags per client per hour; client attribution via `CLIENT_IP_HEADER` and `CLIENT_IP_TRUSTED_HOPS`.
  Off until `ENABLE_FLOOD_CAPTURE` and `NEXT_PUBLIC_ENABLE_FLOOD_CAPTURE` are true.
- **[#25] fix: feature flags.** `NEXT_PUBLIC_*` flags are read by their literal names so Next.js inlines them.
- **[#26] fix: flood render, risk panel and location polish.**

## 2026-08-08

- **[`83f48bd`] fix: add visible scroll to risk summary overlay hazard list**
  `RiskSummaryWidget.tsx` (the panel shown after clicking a location on
  `/map`) had no height cap, so on short viewports its bottom — including
  the Insights/Ask AI/Export/Share buttons — was pushed off-screen with no
  way to reach it. The panel now caps its height to the viewport, pins the
  header and action-button footer outside the scroll region, and makes only
  the hazard list / main drivers / nearest-zone section scroll. Added a
  `.scroll-visible` utility (`frontend/app/globals.css`) so the scrollbar
  itself is clearly visible against the dark theme rather than relying on
  the site's default thin/near-transparent one. Verified live on
  `resiliencemapai.online` by fetching the deployed CSS/JS bundles and
  confirming both the `.scroll-visible` rule and the `overflow-y-auto`
  hazard-list markup are present.
  Docs updated: `README.md`, `PRD.md`, `ARCHITECTURE.md`,
  `TECHNICAL_DOCUMENTATION.md`, `DOCUMENTATION_INDEX.md`.
