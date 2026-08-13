# Proposed Integration Architecture

```text
Allowlisted external source
  -> provider adapter (timeout, response cap, redirect disabled)
  -> Pydantic validation
  -> normalized event/facility contract
  -> authority classification and provenance
  -> deterministic deduplication
  -> cache/persistence and provider health
  -> bounded event API
  -> Map, dashboard, reports, and optional grounded AI
```

Keep the existing `backend/app/data_sources` registry and sync health/audit patterns. Add no MCP server. All fetches remain server-side; the browser never contacts a provider. Provider adapters return failures as structured degraded states; cached data has a retrieval timestamp and never becomes a low-risk inference.

Authoritative events are USGS and officially published national feeds when a stable, authorized interface is separately verified. GDACS is intergovernmental alert intelligence. EONET and ReliefWeb are supplemental and must never create or outrank an official event. GDELT is prototype-only news discovery. Facility records carry verification level; OSM is always `COMMUNITY_MAPPED`.

Normalized event minimum: `event_id`, `provider_event_id`, `provider`, `source_tier`, `hazard_type`, `title`, GeoJSON `geometry`, `event_time`, `updated_at`, `retrieved_at`, `severity`, optional `magnitude`, `source_url`, `official`, and `raw_metadata` (bounded, redacted). Canonical identity is provider plus provider ID; cross-provider correlation is advisory and cannot erase provenance.
