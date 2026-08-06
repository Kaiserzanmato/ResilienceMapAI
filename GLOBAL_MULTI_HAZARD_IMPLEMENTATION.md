# Global Multi-Hazard Implementation

## Delivered foundation

- `POST /api/assessments` provides a versioned multi-hazard screening contract with assessment geometry, per-hazard evidence, source quality, limitations, confidence, and scoring/registry versions.
- `backend/app/data/coverage_registry.json` is the machine-readable provider registry. Runtime selection follows priority and marks any configured global connector used after a non-executable national source as a visible fallback.
- The current deterministic zone model is exposed only as a `modelled` indicator. Hazards without a configured provider remain `no-data`; missing values are never treated as zero.
- Interactive search is routed through the backend. Production uses configured self-hosted Photon (`PHOTON_URL`); when absent, only the bounded local gazetteer is returned. The frontend no longer calls public Nominatim.

## Provider status

Only USGS earthquake and NASA FIRMS entries are marked `configured` in this implementation. Other registry entries are metadata-only until their licensing, terms, ingestion pipeline, and operational connector are individually approved. This is intentional: the API must not make source-backed claims from unconnected datasets.

## Deployment gate

Before production deployment, configure `PHOTON_URL`, production CORS, database/cache/queue infrastructure, provider credentials where applicable, and confirm Vercel/Render credentials and logs. The codebase currently has no checked-in Render service definition or deployment credentials, so deployment and a live-domain claim are blocked pending platform access.

## Scale limits

This change is an API contract and routing foundation, not evidence of 100-million-user readiness. PostGIS dataset ingestion, durable caching, queue workers, load tests, and production SLO telemetry remain required before making that claim.
