# Flood auto-capture (Sentinel-1/2 to PostGIS)

A user flags a spot as flooding; the backend finds the newest Sentinel scene over
it, measures the open water in a 5 km box, stores the polygons in PostGIS and the
map draws them. Everything is off until `ENABLE_FLOOD_CAPTURE` (backend) and
`NEXT_PUBLIC_ENABLE_FLOOD_CAPTURE` (frontend) are `true`.

## Flow

1. `POST /api/flood/flags {lat, lng, note?, observed_at?}` saves the flag and a
   queued job, returns 202 `{flag_id, job_id}`, then starts the capture after the
   response is sent. Three flags per client per hour (`FLOOD_FLAGS_PER_HOUR`; 429 with
   `Retry-After` after that). Only an HMAC of the client IP is stored. Behind Render set
   `CLIENT_IP_HEADER=x-forwarded-for` (with `CLIENT_IP_TRUSTED_HOPS`, default 1), otherwise every
   visitor shares the proxy's address and one bucket.
2. The worker claims the job (`FOR UPDATE SKIP LOCKED` + a 5 minute lease), one at a
   time per process, and runs the blocking work in a thread.
3. Scene search (`app/flood/stac.py`): newest `sentinel-1-rtc` VV on Planetary
   Computer in the last 12 days; then Sentinel-2 L2A from Element 84 Earth Search
   under 40% cloud. `sentinel-1-grd` is never used (requester-pays).
4. Capture (`app/flood/capture.py`): windowed COG reads of the box only.
   * Sentinel-1: VV to dB, Otsu threshold clamped to -23..-15 dB (-18 fallback), 3x3
     median, specks under 0.5 ha dropped.
   * Sentinel-2: NDWI > 0 with cloud, shadow, cirrus, snow and no-data masked out
     using the SCL layer.
   * Subtract permanent water (JRC Global Surface Water occurrence, see below).
   * Polygonize, reproject to EPSG:4326, simplify about 10 m, store as MultiPolygon.
5. The result is cached per `(source, scene_id, tile_key)`; a later flag in the same
   0.025 degree cell and the same scene links the existing extent instead of
   reading the imagery again. An extent with no `flood_ha` (captured before migration
   0007, or the JRC fetch failed) is not reused: it is recaptured and updated in place.
6. A job that fails is retried (60 s, then 120 s back-off) up to 3 attempts, then
   `failed` with a reason code from a closed list (`app/flood/reasons.py`); raw
   exception text is never stored or returned.

Jobs live in the database, so they survive the free Render instance sleeping. A
lease that expires means the instance died mid-job; `GET /api/cron/flood-captures`
(called by `.github/workflows/sync-sources.yml` every 6 hours) reclaims it.

## API

| Route | Notes |
|---|---|
| `POST /api/flood/flags` | 202; 422 on bad input; 429 over the limit |
| `GET /api/flood/jobs/{id}` | status, attempts, reason code and message, extent summary |
| `GET /api/flood/extents?bbox=&since=` | GeoJSON, max 500 features, ETag, `truncated` flag |
| `GET /api/flood/flags?bbox=` | points only; no notes, no client hash |
| `GET /api/flood/tiles/{z}/{x}/{y}.mvt` | `ST_AsMVT`, zoom 8 and up (204 below) |
| `GET /api/cron/flood-captures` | `Bearer CRON_SECRET`; 403 when the secret is unset |

`bbox` is `west,south,east,north`, at most 30 degrees on a side.

Every extent summary (jobs and extents) carries `water_area_m2` (the area of the stored polygons: the flood once
the filter ran), `total_water_ha` (all open water seen), `flood_ha` (total minus permanent water, or `null` when
unfiltered) and `permanent_water_filtered` (true when `flood_ha` is not null); vector tiles carry the three area
fields. Records from before migration 0007 report `total_water_ha` from `water_area_m2`, `flood_ha: null` and
`permanent_water_filtered: false`.

## Guardrails

* Capture areas over 100 km2 are refused (`AreaTooLarge`); the default box is 5 km.
* Windows over 4M pixels are refused; GDAL cache is 64 MB. A real 5 km capture
  peaked at about 106 MB resident including the app, well inside a 512 MB
  free instance.
* One capture at a time per process.
* Raster libraries are imported lazily: the API starts without them
  (`tests/test_db_isolation.py` blocks them and imports the app).

## How captures are drawn and found (frontend)

* Each extent carries `aoi_bbox` (the whole 5 km capture box). The map draws the water
  polygons, a dashed outline of the box, and a marker at the box centre below zoom 11:
  a box of small ponds is only a few pixels wide at overview zooms, so polygons alone
  looked like nothing had rendered. All flood layers are kept above the risk zones,
  heatmap and event layers.
* After a capture finishes, and from "Zoom to capture" in the risk panel, the map fits
  the box (max zoom 13).
* The extents shown follow the map view (padded, rounded `bbox`, debounced); a view wider
  than the API's 30 degree cap falls back to the newest 500 worldwide.
* `GET /api/flood/extents` is cacheable for 60 s, so the frontend asks with
  `cache: "no-cache"` (the ETag makes that a cheap 304). Without it the refetch after a
  capture was answered from the browser cache and the new water never appeared.
* The risk panel always has a Flood row (`frontend/lib/flood-indicator.ts`). With a capture whose box covers the
  clicked spot it shows satellite evidence ("about X ha flooded (Y ha of permanent water excluded), N% of the
  captured box, scene of DATE. Satellite-observed, not an official flood map.") and a score, and the score joins
  Overall (the hazard count goes from "1 of 13" to "2 of 13"). With none it says "No satellite capture yet: flag
  flooding here" (and the nearest capture within 15 km, if any). With the Flood layer selected the Flood row is
  first; with Overall Risk the rows are sorted by score.
* The score is the flooded share of the 5 km box scaled so half the box is 100, times a recency weight (full to 7
  days, falling linearly to 0.25 at 30 days). A scene older than 30 days is shown but not scored and left out of
  Overall. An unfiltered capture (permanent water not removed) is capped at 60 and says it is unfiltered. These
  weights are judgement, set as constants in `flood-indicator.ts`; it is a satellite observation, not an official
  flood map, a forecast or a modelled return period.
* The flag button says whether anything was sent when a request fails, and what an existing capture at the spot
  means (an unfiltered one is recaptured with the filter when flagged again).

## Limits of the method

* It maps **open surface water**, not "flood". Permanent water is subtracted with the JRC layer (below), but
  that layer ends in 2021, so newer water bodies are not excluded, and there is no change-detection step
  against a pre-event scene.
* VV radar misses flooding under dense vegetation or in built-up areas, can
  confuse smooth dry surfaces (sand, tarmac) with water, and loses data on steep
  slopes (radar shadow). Optical scenes are limited by cloud.
* Boxes that cross the antimeridian are not supported.
* Results are labelled satellite-derived with the scene date and source, and carry
  the Copernicus Sentinel attribution.

## Permanent water

Each capture subtracts permanent water using the JRC Global Surface Water
*occurrence* layer (Planetary Computer `jrc-gsw`, 30 m, 1984-2021): pixels at or
above `FLOOD_PERMANENT_WATER_THRESHOLD` percent (default 75) are removed, clipped
to the capture box, and water slivers under 0.5 ha left along banks are dropped.
`flood_extents.total_water_ha` is all water seen, `flood_ha` is the flood after
subtraction, and `water_area_m2` / the stored polygons are the flood only. If JRC
cannot be fetched the extent is saved as before with `flood_ha` NULL and
`method.permanent_water.status = "unfiltered"`; such extents (and any captured
before migration 0007) are recaptured on the next flag in the same cell. JRC data
ends in 2021, so water bodies created since (new fishponds, reservoirs) are not excluded.

## Settings

`ENABLE_FLOOD_CAPTURE`, `FLOOD_FLAGS_PER_HOUR` (3), `FLOOD_AOI_KM` (5),
`FLOOD_PERMANENT_WATER_THRESHOLD` (75),
`FLOOD_SCENE_WINDOW_DAYS` (12), `FLOOD_MAX_ATTEMPTS` (3), `FLOOD_LEASE_SECONDS` (300),
`FLOOD_INLINE_PROCESSING` (true), `FLOOD_CRON_BUDGET_SECONDS` (90), `FLOOD_HASH_SALT`.
Client attribution (shared with the usage quotas): `CLIENT_IP_HEADER`, `CLIENT_IP_TRUSTED_HOPS`. Frontend:
`NEXT_PUBLIC_ENABLE_FLOOD_CAPTURE`. Full list with secret vs config: [ENVIRONMENT.md](./ENVIRONMENT.md);
examples in `backend/.env.example`. Production runbook (migrations, sync, rollback): [OPERATIONS.md](./OPERATIONS.md).

## Schema

Alembic `0006` creates `flood_flags`, `flood_extents` and `flood_capture_jobs`; `0007` adds nullable
`flood_extents.total_water_ha` and `flood_ha` (metadata-only, no backfill; its downgrade drops just those two
columns). Downgrading `0006` drops all three tables and their data.

## Verified Oct 3, 2026 (production)

Flagged a real spot in Candaba, Pampanga (15.092, 120.827) on `resiliencemapai.online` end to end:
request, capture job, polygons on the map, and the risk panel's Flood/Overall update. One flag, no
retries.

| | Before | After |
|---|---|---|
| Flood | 60 · Medium (capped — unfiltered capture, scene 2026-09-19) | 72 · High |
| Overall | 50 · Medium | 56 · Medium |
| Scene | Sentinel-1, 2026-09-19, permanent water unfiltered | Sentinel-1 (S1C RTC), 2026-10-01, filter applied |
| Flood area | 1,224 ha open water (permanent water included) | 902.37 ha flooded (37 ha permanent water excluded), 36% of the 5 km box |

The prior capture's JRC fetch had failed, leaving it unfiltered and capped per the rule above; the
new flag picked up the newest Sentinel-1 scene and the JRC fetch succeeded, so the cap no longer
applies and the score reflects the filtered flooded share directly. Checked responsive at 390px with
no additional flag (`scrollWidth` stayed within the viewport; the flag button correctly offered to
reuse the just-created capture rather than recapture it). Screenshots: `docs/screenshots/candaba-flag/`.
