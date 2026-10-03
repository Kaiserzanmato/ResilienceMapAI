# Changelog

All notable changes to ResilienceMap AI are logged here, newest first. This
file starts from 2026-08-08 (entries for #22 to #30 were added 2026-10-02 from
the merged PRs); for full history before that, see `git log` and
the narrative "Recent fixes" section in `README.md`, which already covers
the Aug 6–7 geocoding-gateway and dashboard/globe/weather work in detail.

Format: `[commit] type: summary`, followed by what changed and why when it
isn't obvious from the summary alone.

## 2026-10-03 (wildfire history/freshness and honest no-data labels)

- **[#42] fix: Wildfire stopped showing "Stale" everywhere except Mayon, and every no-data row got its
  own reason.** Audit: freshness and history length were both read from `fire_detections` itself, so a
  pruned or recreated table reset them even though FIRMS kept syncing; Mayon's own non-zero score was
  volcanic heat 0.2 km from the summit, not wildfire. Elsewhere, Volcanic (pending PHIVOLCS permission)
  and Cyclone/Landslide/Drought/Heat (no connector at all) all collapsed into the same "Temporarily
  unavailable" label. Also audited whether `fire_detections` had lost rows (production sync logs once
  showed 12,518 and 34,518 records): it never had — migration `0008` created the table and wired FIRMS
  persistence in the same change (commit `7648238`, Oct 2); before that the sync counted downloaded rows
  and discarded them, so those figures are old `sync_audit_log` counts, not rows that later vanished.
  - FIRMS sync now fetches a 2-day window, not 1, so a run near UTC midnight can't miss a day.
  - Self-healing backfill: when `sync_health.first_successful_sync_at` is younger than
    `MIN_HISTORY_DAYS` (7), the sync also fetches FIRMS's own max 10-day range once (idempotent upserts).
  - History and staleness now come from `sync_health` (`first_successful_sync_at`, new; `0009`;
    `last_successful_sync_at`), never from the stored detections, so pruning or recreating the table can't
    reset them. Zero fires with a fresh sync is a valid low score, not Stale.
  - FIRMS detections within 5 km of a known PH active volcano summit (Smithsonian GVP coordinates, not
    PHIVOLCS) are excluded before wildfire scoring.
  - New honest reason codes in `global_assessment.py`: `licence_pending` (Volcanic while
    `ENABLE_VOLCANIC_SCORING=false`), `no_connected_source` (a source is registered but nothing is wired
    to it), `not_covered` (no source registered at all), `stale`. The frontend's label mapping moved to
    its own pure module, `frontend/lib/hazard-status.ts`; the "Temporarily unavailable" catch-all is gone.
  - `sync-sources.yml` now runs every 2 hours, not 6.
  - Added Lucide icons for `active_fault`, `tsunami`, `land_subsidence`, `sinkhole`.
  - **Migration `0009` must be applied before this code is deployed** — `record_success`/the wildfire
    read path write/read `sync_health.first_successful_sync_at`, which does not exist before `0009` runs.
    Same out-of-band procedure as every other migration (`docs/OPERATIONS.md`); nothing in this repo
    applies it automatically.

## 2026-10-03 (map layering and responsive layout)

- **fix: dialogs and map popups no longer open under the search bar and "Run AI Risk Assessment".** Root cause: the Insights dialog was
  rendered inside the risk-summary wrapper, whose own z-index (20/30) trapped its `z-50` below the command bar (`z-40`, at the page root);
  the evacuation card cleared only the nav plus 12 px, but the command bar sits lower and is taller than that. Fixes:
  one z-index scale as tokens (`--z-map` ... `--z-toast` in `globals.css`, used everywhere instead of bare numbers);
  `components/ui/Modal.tsx` renders through a portal at `<body>` with a backdrop above all controls, a focus trap (including Safari, whose Tab
  skips buttons), Esc to close, scroll lock, a sticky header and a body that scrolls inside; `lib/map-layout.ts` measures the free area from
  `data-map-obstruction` markers so the evacuation card and every MapLibre popup (which has no autoPan) open fully visible.
- **fix: phone layout.** The command bar is one compact row (icon-only Run AI button); the risk panel is a bottom sheet that starts as a peek
  (header and actions) with a toggle for the hazard details; the Map Layers card scrolls inside its own bounded area; dvh and safe-area insets.
- **test: Playwright e2e** (`npm run test:e2e`; chromium, webkit, firefox, iPhone 14, Pixel 7, iPad) with the backend mocked: no floating
  control may cover the Insights dialog header/close button or overlap the evacuation card at 360, 390, 768, 1024, 1280, 1440 and 1920 px;
  Esc, focus trap, scroll lock, 44 px tap target and reduced motion. A CI workflow runs it on frontend changes. Before/after screenshots:
  `docs/screenshots/responsive-fix/`.

## 2026-10-02 (stale-score leak on the legacy route)

- **fix: `GET /api/location-risk` no longer shows scores `POST /api/assessments` withholds.** Live check after #32: Mayon returned
  Volcanic 86 (and Tokyo 32) on the legacy route while the assessment said no-data. The route is now deprecated and takes
  Wildfire (FIRMS) and Volcanic (null unless `ENABLE_VOLCANIC_SCORING` has licensed data) from the assessment engine, and the
  overall score and main drivers are derived after that, so they cannot include a withheld number. `score_location` returns
  Volcanic unscored by default, which also covers `/api/compare-locations` and the AI context. The assessment no longer carries a
  Volcanic `indicative_score`, and the frontend adapter drops one if an older backend sends it. Removed the unused
  `api.locationRisk` client call; `llms.txt` marks the route deprecated. Other legacy callers still get zone-model Wildfire.

## 2026-10-02 (wildfire and volcanic scores)

- **feat: Wildfire and Volcanic Activity get real scores in the risk panel.** Audit: the FIRMS sync downloaded detections and
  dropped them (no normalizer, nothing stored), and Volcano had no data. Now the sync stores detections in `fire_detections`
  (Alembic `0008`, geography point + GiST index) and Wildfire is scored from detections within 10 km over 7 and 30 days
  (confidence and FRP weighted; evidence: counts, nearest distance, last seen); Volcanic scoring (distance bands to the nearest Philippine
  volcano) is implemented but **off by default and ships no data**: the Smithsonian GVP list's terms allow non-commercial use only and
  the repo is public, so it was removed; a loader expects a PHIVOLCS-sourced file (`VOLCANO_DATA_FILE`) later. Wildfire feeds Overall and
  "N of 13", stays no-data outside coverage, and is labelled an indicator, not an official hazard map. The PHIVOLCS alert level is not
  live. `ENABLE_WILDFIRE_SCORING`, `ENABLE_VOLCANIC_SCORING`, `VOLCANO_DATA_FILE`, `scripts/backfill_firms.py`, `docs/WILDFIRE_VOLCANIC.md`.

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
