# Current Event Integration Architecture

Implemented on `feature/realtime-disaster-intelligence`; feature disabled by default.

```text
USGS / GDACS / EONET / ReliefWeb
  -> existing fixed-endpoint connectors
  -> response-size and JSON-object validation
  -> Pydantic normalized event contract
  -> provider provenance and Tier 5/Tier 4 classification
  -> provider-ID deduplication and conservative cross-provider links
  -> in-memory shared cache and safe provider health metadata
  -> bounded GET /api/events
  -> feature-gated clustered MapLibre overlay
```

`ENABLE_REALTIME_EVENTS=false` is the server-side kill switch. The browser layer is separately gated by `NEXT_PUBLIC_ENABLE_REALTIME_EVENTS=false`. Events do not enter the deterministic risk engine, and AI is not invoked during ingestion. USGS is Tier 5 official observation; GDACS is Tier 4 intergovernmental alert intelligence; EONET and ReliefWeb are Tier 4 supplemental context. Supplemental records remain separate and cannot overwrite official provenance.

The cache is intentionally in-memory for this release. It preserves last-known events during an upstream failure within an instance, but does not survive restarts or synchronize multiple instances. A future persistence phase needs a reviewed migration and shared cache.
