# Final Research and Integration Specification

## Executive conclusion

**GO FOR A NARROW, FEATURE-FLAGGED IMPLEMENTATION AFTER EXPLICIT HUMAN APPROVAL.** The existing platform already has a source registry, four wired remote connectors, health/audit hooks, deterministic assessment, grounded-AI controls, MapLibre, and optional PostGIS. It does not yet have a single validated event contract, durable normalized-event pipeline, bounded event API, or a verified facility/translation integration.

The approved candidate set is deliberately small: USGS GeoJSON/FDSN (authoritative earthquake evidence), GDACS (intergovernmental multi-hazard alerts), and existing EONET/ReliefWeb as visibly supplemental context. Static UI translation may use `next-intl`. No MCP, public Overpass production access, GDELT production ingestion, self-hosted LibreTranslate, mobile app, push notification, or predictive scoring is approved.

## Existing architecture and preservation

Preserve the current deterministic pipeline: hazard evidence -> backend scoring -> risk classification -> grounded AI explanation. `null` remains unknown, never safe or zero. The source registry is the source-of-truth and the frontend registry is generated from it. Existing sync failures already preserve availability and must remain isolated. Secrets are server-only; provider data is untrusted input.

## Provider evidence and observed benchmark

The 2026-08-13 isolated USGS summary-feed probe completed ten HTTP 200 requests at approximately 0.48-0.61 seconds. The first GDACS probe timed out after 20 seconds; this validates the need for timeout, cached-last-known data, provider health, and no UI dependency on live upstream response. Browser sandbox DNS blocked direct probes; conclusions otherwise rely on linked primary documentation and are not claims of provider SLA.

USGS advises automated applications to prefer real-time GeoJSON feeds for display and offers FDSN custom detail queries. GDACS documents free GeoJSON API access and source acknowledgement. EONET v3 exposes curated near-real-time metadata with source and GeoJSON geometry. ReliefWeb is humanitarian reporting, not authoritative event creation. See `docs/research/providers/`.

## Data contract and trust

Use the contract in `PROPOSED_INTEGRATION_ARCHITECTURE.md`. Tier 5 official data can drive evidence; Tier 4 data is corroborative/alert intelligence; Tier 1-3 never becomes official by transformation. Deduplicate by provider identity first; only attach cross-provider correlations with separate source records and confidence. AI receives cited, bounded, sanitized data labelled as data, not instructions.

## Security, privacy, reliability, and cost

Use fixed provider allowlists, TLS verification, DNS/IP SSRF denial for localhost/private/link-local/metadata ranges, redirect limits, request and response bounds, Pydantic validation, HTML sanitization, cache TTL/stale-while-revalidate, backoff/jitter/cooldown, and structured no-secret logs. Do not send user account identity, precise location, or locale upstream unless the provider request demonstrably requires it. Scheduled shared ingestion replaces user-triggered provider calls. Translation is not approved until accuracy, operations cost, and emergency-content review are benchmarked.

## Acceptance criteria and approval gate

Before implementation: branch from the recorded baseline; pass baseline tests; add provider and failure/security tests; preserve all map/assessment/report behavior; maintain citations and freshness; complete docs, audit, local smoke, and deployment gates in the build specification. This research phase has made **no production code, schema, dependency, configuration, environment, or deployment change**.

## Go / No-Go

**RESEARCH RECOMMENDATION: CONDITIONAL GO.** The scope above is technically compatible, but production implementation must wait for explicit human approval of this document, as required by the research specification. The build specification must not be started before that approval.
