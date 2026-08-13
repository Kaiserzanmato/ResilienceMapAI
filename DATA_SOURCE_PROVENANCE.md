# Current Event Provenance

Every `GET /api/events` record has a canonical `event_id` (`provider:provider_event_id`), provider name, source tier, authority classification, source URL, source update/event time where supplied, and retrieval time. The API returns raw metadata only from bounded allowlisted provider fields.

USGS event IDs and source URLs are retained and records are `official=true`, Tier 5. GDACS records are Tier 4 and `official=false`; their alert status is not a national-agency instruction. EONET and ReliefWeb are supplemental Tier 4 records. ReliefWeb text remains untrusted external data and is not passed to AI by this implementation.

Duplicate records from the same provider collapse by canonical event ID. Potentially related cross-provider records remain independent records and receive conservative `related_event_ids` only when hazard taxonomy, event time (within 24 hours), and point proximity (within 100 km) agree.
