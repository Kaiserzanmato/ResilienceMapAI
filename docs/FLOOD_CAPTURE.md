# Flood auto-capture (Sentinel-1/2 to PostGIS)

A user flags a spot as flooding; the backend finds the newest Sentinel scene over
it, measures the open water in a 5 km box, stores the polygons in PostGIS and the
map draws them. Everything is off until `ENABLE_FLOOD_CAPTURE` (backend) and
`NEXT_PUBLIC_ENABLE_FLOOD_CAPTURE` (frontend) are `true`.

## Flow

1. `POST /api/flood/flags {lat, lng, note?, observed_at?}` saves the flag and a
   queued job, returns 202 `{flag_id, job_id}`, then starts the capture after the
   response is sent. Three flags per client per hour (429 after that). Only an HMAC
   of the client IP is stored.
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
   * Polygonize, reproject to EPSG:4326, simplify about 10 m, store as MultiPolygon.
5. The result is cached per `(source, scene_id, tile_key)`; a later flag in the same
   0.025 degree cell and the same scene links the existing extent instead of
   reading the imagery again.
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
* With the Flood layer selected, the risk panel shows the newest capture whose box covers
  the clicked spot (scene date, source, water area), or the nearest one within 15 km. It
  never shows a flood score.

## Limits of the method

* It maps **open surface water**, not "flood". Permanent water (rivers, lakes,
  fishponds) is included; there is no reference-water or change-detection step yet.
* VV radar misses flooding under dense vegetation or in built-up areas, can
  confuse smooth dry surfaces (sand, tarmac) with water, and loses data on steep
  slopes (radar shadow). Optical scenes are limited by cloud.
* Boxes that cross the antimeridian are not supported.
* Results are labelled satellite-derived with the scene date and source, and carry
  the Copernicus Sentinel attribution.

## Settings

`ENABLE_FLOOD_CAPTURE`, `FLOOD_FLAGS_PER_HOUR` (3), `FLOOD_AOI_KM` (5),
`FLOOD_SCENE_WINDOW_DAYS` (12), `FLOOD_MAX_ATTEMPTS` (3), `FLOOD_LEASE_SECONDS` (300),
`FLOOD_INLINE_PROCESSING` (true), `FLOOD_CRON_BUDGET_SECONDS` (90), `FLOOD_HASH_SALT`.
Client attribution (shared with the usage quotas): `CLIENT_IP_HEADER`, `CLIENT_IP_TRUSTED_HOPS`. See `backend/.env.example`.
