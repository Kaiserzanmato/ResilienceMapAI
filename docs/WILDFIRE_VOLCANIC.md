# Wildfire and Volcanic scores

**Current as of:** 2026-10-03. Both rows come from `POST /api/assessments`, are folded into the overall score
("from N of 13 hazards") and stay **No data** wherever coverage is missing. Neither is an official hazard map.

## Why these rows used to be empty

The assessment only gives a score to hazards with a verified source, and only earthquake had one (the legacy zone model is
allowed to score nothing else). Wildfire had a configured connector (NASA FIRMS) but the sync **counted the rows it downloaded
and discarded them**: `nasa-firms` had no normalizer, so nothing was stored in Postgres. Volcano had no data at all, only a
metadata-only registry entry (Smithsonian GVP, PHIVOLCS), and still has none in the repo (see below).

## Wildfire (`backend/app/services/wildfire_scoring.py`)

* **Data:** every sync stores the FIRMS VIIRS detections it downloads in `fire_detections` (Alembic `0008`): position as a PostGIS
  `geography(Point, 4326)` with a GiST index, acquisition time (UTC), satellite, confidence, FRP, day/night. A unique key on
  (source, acquisition time, latitude, longitude) makes the overlapping downloads idempotent. Rows older than 35 days are pruned.
  The sync itself asks FIRMS for a 2-day window, not 1, so a run near UTC midnight cannot miss a day's detections.
* **Self-healing history:** `sync_health.first_successful_sync_at` (Alembic `0009`) is when FIRMS syncing *first* ever succeeded, set
  once and never moved. When that is younger than `MIN_HISTORY_DAYS` (7), each sync also fetches FIRMS's own maximum 10-day range once
  — the same range `scripts/backfill_firms.py` uses for a manual backfill (see [OPERATIONS.md](./OPERATIONS.md)) — so a fresh deploy or
  a long gap in syncing does not take a week to recover. Upserts are idempotent, so this is safe to run on every sync while short.
* **Query:** `ST_DWithin(geog, point::geography, 10000)` over the last 30 days (`app/repositories/fire_repo.py`).
* **Volcano heat filter:** detections within 5 km (`VOLCANO_EXCLUSION_RADIUS_KM`) of a known PH active volcano summit are excluded
  before scoring — `wildfire_scoring.PH_ACTIVE_VOLCANO_SUMMITS`, a small hardcoded list from the Smithsonian Global Volcanism Program
  (volcano.si.edu), deliberately **not** PHIVOLCS (whose data is still pending permission — see Volcanic Activity below). Without
  this, a volcano's own heat signature reads as a false-positive wildfire (Mayon showed a non-zero score from detections 0.2 km from
  its summit before this filter existed).
* **Score:** each surviving detection within 10 km counts with weight `recency x confidence x FRP`. Recency is 1.0 for the last 7 days
  and 0.4 for days 8 to 30. Confidence is `l/n/h = 0.3/0.7/1.0` (a 0 to 100 value is divided by 100; unknown 0.5). The FRP weight is
  `0.5 + 0.5 x min(1, FRP / 50 MW)`. Score = `100 x (1 - exp(-sum / 6))`: one strong recent detection is about 15 (Low), a handful is
  Medium, a dozen or more is High.
* **Evidence shown:** detections in the last 7 and 30 days, nearest distance, last-seen date, and the length of the detection history.
  Labelled "satellite-observed active fire, not an official hazard map". A detection is a hot pixel, and FIRMS also sees agricultural
  and prescribed burning.
* **No data, honestly:** the point is outside `NASA_FIRMS_AREA` (out of coverage, `outside_firms_area`); FIRMS syncing has never
  succeeded, or its last success is older than 48 hours (stale, `fire_data_stale`) — judged from `sync_health.last_successful_sync_at`,
  **not** from the newest stored detection, so a pruned or recreated table can never masquerade as staleness; or there are no
  detections but syncing has succeeded for less than 7 days (`fire_history_too_short` — a zero is only reported once we have been
  looking long enough, and that "long enough" is measured from the first successful sync, not from the oldest surviving row). If the
  store cannot be read, the row stays no-data and the assessment still succeeds.
* **Switch:** `ENABLE_WILDFIRE_SCORING` (default true). Needs both migrations `0008` (the table) and `0009`
  (`first_successful_sync_at`) applied — `0009` must be applied before this code is deployed, since the sync-success and wildfire-read
  paths write/read that column.

## Volcanic Activity (`backend/app/services/volcano_scoring.py`) — off by default, no data shipped

**Decision (2026-10-02): no volcano list is committed, and `ENABLE_VOLCANIC_SCORING` defaults to `false`.**
The Smithsonian Global Volcanism Program list was the first candidate. Its terms (Smithsonian Terms of Use, via
volcano.si.edu/gvp_termsofuse.cfm) allow personal, educational and non-commercial use with citation and require prior written
permission for commercial use or publication, and this repository is public. The project's coverage registry also lists both GVP
and PHIVOLCS as `license_status: review-required`, and the Sprint 1 docs require an approved evidence package before volcano scoring.
So the extract that an earlier draft of this work contained was removed, and the feature waits for a list whose terms allow it.

* **What exists:** the scoring code and a loader. `VOLCANO_DATA_FILE` points at a JSON file outside the repo; if it is unset, missing or
  invalid (wrong shape, bad status, out-of-range coordinates) the hazard stays **no-data**, never zero and never an error. While
  `ENABLE_VOLCANIC_SCORING` is `false`, the row's `reason_code` is `licence_pending` (panel label: "Pending PHIVOLCS data permission")
  — distinct from a hazard with no source registered at all, or one with a source but no connector wired up yet; see
  [ARCHITECTURE.md](../ARCHITECTURE.md)'s reason-code table and `global_assessment.py`'s `_coverage_state`.
* **Expected file (a PHIVOLCS-sourced list, once PHIVOLCS permits it):**
  ```json
  {"source": {"name": "...", "url": "https://...", "retrieved": "YYYY-MM-DD", "licence_note": "..."},
   "volcanoes": [{"name": "...", "latitude": 13.257, "longitude": 123.685,
                  "status": "active" | "potentially active", "last_eruption_year": 2026}]}
  ```
  `last_eruption_year` may be null. The `source` block is shown as the row's evidence source.
* **Score (when enabled with a valid file):** distance to each volcano, danger-zone-style bands: within 6 km 90, within 10 km 75,
  within 30 km 45, within 100 km 15, beyond 0. A potentially active volcano counts for half; the highest band wins. Philippines only;
  elsewhere no-data. The bands follow the shape of PHIVOLCS danger zones, not their legal boundaries.
* **Alert level:** the current PHIVOLCS alert level is **not live**: PHIVOLCS publishes bulletins, not a reliable machine-readable feed,
  so the row says so and links to PHIVOLCS.
* **To turn it on:** obtain a list with usable terms (PHIVOLCS permission, or written Smithsonian permission), put it on the Render
  instance (a secret file or a path baked into your deploy, not this repo), set `VOLCANO_DATA_FILE` and `ENABLE_VOLCANIC_SCORING=true`.

## In the panel

`HazardScore.note` carries the evidence line and `link` the PHIVOLCS pointer; `RiskSummaryWidget.tsx` shows them under the row, and
`lib/assessment-adapter.ts` includes both scores in Overall and the hazard count.

## External dependencies

* **Volcanic scoring is blocked on PHIVOLCS permission** (requested 2026-10-02; PHIVOLCS then asks for a request form and a Data User
  Agreement). Nothing is built beyond the loader and tests, and `ENABLE_VOLCANIC_SCORING` stays `false`. Status and the checklist for
  switching it on: [issue #34](https://github.com/Kaiserzanmato/ResilienceMapAI/issues/34).
* Wildfire depends on NASA FIRMS (live, Philippines box). Flood capture depends on Copernicus Sentinel scenes and the JRC Global Surface
  Water layer. Their status is in the issue's table.
