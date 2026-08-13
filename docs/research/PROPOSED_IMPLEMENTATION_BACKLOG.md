# Proposed Implementation Backlog

## P0

1. Normalize the already-wired USGS, GDACS, EONET, and ReliefWeb connector outputs behind the existing registry; add validation, bounded caching, source provenance, health metadata, and tests. Complexity M; risk M; no new provider; requires existing Postgres decision only if persistence is approved.
2. Add a bounded, paginated current-events read API and MapLibre layer for authoritative and explicitly supplemental events. Complexity M; risk H because map regression; feature-flag and test all six map views.
3. Harden Firecrawl/news ingestion: source allowlist, SSRF IP/DNS checks, HTML/text bounds, prompt-injection isolation, citation-only AI context. Complexity M; risk H.

## P1

1. Static UI internationalization using `next-intl`, initially English/Filipino; preserve routes through a documented migration. Complexity M; risk M.
2. Official facility import pipeline for a specifically licensed government/HDX dataset. Complexity L; risk H; no OSM auto-labeling.

## P2

1. EONET/ReliefWeb event correlation and on-demand cited summaries. Complexity M; risk M.
2. Translation prototype in an isolated deployment with emergency-language human review. Complexity L; risk H.

## Future / Rejected

Native apps, push notifications, geofencing, predictive modeling, and MCP are out of scope. Public Overpass, GDELT, and dynamic translation are not production implementations without a separate prototype decision.
