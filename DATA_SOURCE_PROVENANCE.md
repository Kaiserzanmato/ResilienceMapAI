# Current Event Provenance

Every `GET /api/events` record has a canonical `event_id` (`provider:provider_event_id`), provider name, source tier, authority classification, source URL, source update/event time where supplied, and retrieval time. The API returns raw metadata only from bounded allowlisted provider fields.

USGS event IDs and source URLs are retained and records are `official=true`, Tier 5. GDACS records are Tier 4 and `official=false`; their alert status is not a national-agency instruction. EONET and ReliefWeb are supplemental Tier 4 records. ReliefWeb text remains untrusted external data and is not passed to AI by this implementation.

Duplicate records from the same provider collapse by canonical event ID. Potentially related cross-provider records remain independent records and receive conservative `related_event_ids` only when hazard taxonomy, event time (within 24 hours), and point proximity (within 100 km) agree.

## Volcano summit coordinates (wildfire's volcano-heat filter)

`backend/app/services/wildfire_scoring.py`'s `PH_ACTIVE_VOLCANO_SUMMITS` — the six PH active-volcano summit
coordinates used to exclude volcanic heat from wildfire scoring (within 5 km) — are sourced from the
**Smithsonian Global Volcanism Program** (volcano.si.edu), not PHIVOLCS. This is a separate, much smaller use
than the full Volcanic Activity hazard score: six public summit coordinates hardcoded as a Python constant,
not a redistributed dataset. The Volcanic Activity row itself still ships no volcano list and stays off by
default (`ENABLE_VOLCANIC_SCORING=false`) pending PHIVOLCS's own written permission — see
[docs/WILDFIRE_VOLCANIC.md](docs/WILDFIRE_VOLCANIC.md) and [issue #34](https://github.com/Kaiserzanmato/ResilienceMapAI/issues/34).
