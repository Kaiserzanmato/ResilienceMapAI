# ResilienceMap AI - System Architecture

## Overview

ResilienceMap AI is a full-stack disaster risk intelligence platform combining:
- **Frontend**: Next.js 16 with React 19, real-time interactive mapping
- **Backend**: FastAPI with deterministic risk scoring engine
- **Database**: PostgreSQL (optional; in-memory fallback for demo)
- **Deployment**: Vercel (frontend) + Render (backend)

**Core Principle**: Hazard data → backend scoring → risk color → AI explanation
The AI explains calculated scores; it never invents them or overrides official advisories.

---

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          BROWSER (Client)                               │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │              ResilienceMap AI - Next.js Frontend (3000)            │ │
│  ├────────────────────────────────────────────────────────────────────┤ │
│  │                                                                    │ │
│  │  Pages:                                                            │ │
│  │  ├─ Landing (/)                  - Marketing page                │ │
│  │  ├─ Map (/map)                   - Interactive hazard mapping   │ │
│  │  ├─ Weather (/weather)           - OWM tile layers + Zoom.Earth │ │
│  │  ├─ Dashboard (/dashboard)       - Executive KPIs               │ │
│  │  ├─ AI Workspace (/agents)       - Persona-based assistant     │ │
│  │  ├─ Reports (/reports)           - PDF/CSV exports             │ │
│  │  ├─ Resources (/resources)       - Documentation & datasets    │ │
│  │  ├─ Datasets (/admin/datasets)   - Data source management      │ │
│  │  └─ Settings (/settings)         - User preferences            │ │
│  │                                                                    │ │
│  │  Same-origin API routes (frontend/app/api/):                      │ │
│  │  ├─ dashboard-stats     - Cached proxy to backend (60s window)   │ │
│  │  ├─ weather-tiles/[..]  - OWM tile proxy (key hidden, rate-limit)│ │
│  │  ├─ weather-current     - OWM current-conditions proxy           │ │
│  │  └─ admin/datasets/upload - RBAC-secret-holding upload proxy    │ │
│  │                                                                    │ │
│  │  Features:                                                         │ │
│  │  ├─ MapLibre GL JS rendering                                     │ │
│  │  ├─ Real-time hazard layer updates                               │ │
│  │  ├─ Ambient globe with d3-geo (local static world-atlas asset)   │ │
│  │  ├─ Dark/light theme toggle                                      │ │
│  │  ├─ Search & filter (new)                                        │ │
│  │  ├─ Rate-limited refresh (new)                                   │ │
│  │  └─ LocalStorage state persistence                               │ │
│  └────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────┬──────────────────────────────────────────────┘
                           │ HTTPS
                           │ REST API Calls
                           ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                     Backend Services (Render)                            │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │              ResilienceMap API - FastAPI (8000)                   │ │
│  ├────────────────────────────────────────────────────────────────────┤ │
│  │                                                                    │ │
│  │  API Endpoints:                                                    │ │
│  │  ├─ GET  /api/location-risk      - Risk assessment              │ │
│  │  ├─ POST /api/compare-locations  - Multi-location compare       │ │
│  │  ├─ GET  /api/geocode            - Reverse geocoding            │ │
│  │  ├─ GET  /api/hazard-layers      - Hazard data (GeoJSON)        │ │
│  │  ├─ GET  /api/hazard-events      - Active hazard events         │ │
│  │  ├─ POST /api/ai/summary         - AI-powered insights          │ │
│  │  ├─ POST /api/agent/query        - Conversational assistant     │ │
│  │  ├─ GET  /api/datasets           - Dataset registry             │ │
│  │  ├─ POST /api/data-sync          - Manual data refresh          │ │
│  │  ├─ GET  /api/sync-health        - Sync status & timestamps     │ │
│  │  ├─ GET  /api/source-registry    - Source metadata              │ │
│  │  ├─ GET  /api/cron/sync-sources  - Scheduled sync (1x daily)    │ │
│  │  └─ GET  /api/reports            - Report endpoints             │ │
│  │                                                                    │ │
│  │  Core Modules:                                                    │ │
│  │  ├─ app/scoring/                 - Risk calculation engine      │ │
│  │  ├─ app/data_sources/            - Data connectors (4 active)   │ │
│  │  ├─ app/ai_providers/            - LLM abstraction layer        │ │
│  │  ├─ app/repositories/            - Data access patterns         │ │
│  │  ├─ app/security.py              - Auth & rate limiting         │ │
│  │  └─ app/middleware.py            - CORS, logging, validation    │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                           │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │         Data Sync Engine & Scheduling                              │ │
│  ├────────────────────────────────────────────────────────────────────┤ │
│  │                                                                    │ │
│  │  Scheduled Sync (Vercel Cron - daily at 00:00 UTC):              │ │
│  │  ├─ GET /api/cron/sync-sources                                   │ │
│  │  ├─ CRON_SECRET authentication                                   │ │
│  │  └─ Dispatch to registered data sources                          │ │
│  │                                                                    │ │
│  │  Supported Data Sources:                                          │ │
│  │  ├─ GDACS (Global Disaster Alert & Coordination System)          │ │
│  │  ├─ NASA EONET (Earth Observation Natural Event Tracker)         │ │
│  │  ├─ USGS Earthquake Hazards Program                              │ │
│  │  ├─ ReliefWeb Humanitarian Data Exchange                         │ │
│  │  └─ 40+ additional sources (registry, not yet synced)            │ │
│  │                                                                    │ │
│  │  Sync Artifacts:                                                  │ │
│  │  ├─ sync_health record (timestamp, status, record count)         │ │
│  │  ├─ audit log (source, status, records, timestamp)               │ │
│  │  └─ Dataset metadata (cached, reusable across requests)          │ │
│  └────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────┬──────────────────────────────────────────────┘
                           │ SQL Queries
                           │ (optional)
                           ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                  PostgreSQL Database (Optional)                         │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │              Neon (Vercel Marketplace) or Local Dev               │ │
│  ├────────────────────────────────────────────────────────────────────┤ │
│  │                                                                    │ │
│  │  Tables:                                                           │ │
│  │  ├─ sync_health               - Sync status & timestamps         │ │
│  │  ├─ audit_log                 - Action history                   │ │
│  │  ├─ datasets                  - Uploaded dataset metadata         │ │
│  │  ├─ reports                   - Shareable report records         │ │
│  │  └─ alembic_version           - Migration tracking               │ │
│  │                                                                    │ │
│  │  Migrations: Alembic (backend/alembic/)                           │ │
│  │  Applied out-of-band, never automatically in serverless          │ │
│  └────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Frontend Architecture

### Directory Structure
```
frontend/
├── app/                           # Next.js App Router
│   ├── (app)/                     # Authenticated routes
│   │   ├── map/                   - Interactive mapping
│   │   ├── weather/               - Weather Map Forecast (NEW)
│   │   ├── dashboard/             - Executive dashboards
│   │   ├── agents/                - AI workspace
│   │   ├── reports/               - Report generation
│   │   ├── resources/             - Documentation & datasets (enhanced)
│   │   ├── admin/datasets/        - Data management (enhanced)
│   │   ├── settings/              - User preferences
│   │   └── layout.tsx             - Shared layout
│   ├── api/                       # Same-origin Route Handlers (NEW)
│   │   ├── dashboard-stats/       - Cached proxy to backend (60s window)
│   │   ├── weather-tiles/[layer]/[z]/[x]/[y]/ - OWM tile proxy, rate-limited
│   │   ├── weather-current/       - OWM current-conditions proxy, rate-limited
│   │   └── admin/datasets/upload/ - RBAC-secret-holding upload proxy
│   ├── layout.tsx                 - Root layout
│   └── page.tsx                   - Landing page
├── components/
│   ├── globe/                     - Ambient globe (local world-atlas asset)
│   ├── map/                       - MapLibre wrapper & layers
│   ├── weather/                   - Weather map + layer control (NEW)
│   ├── charts/                    - Recharts visualizations
│   ├── ui/                        - Design system (GlassCard, etc.)
│   └── ...                        - Other reusable components
├── lib/
│   ├── api.ts                     - API client & endpoints
│   ├── weatherLayers.ts           - OWM layer key/label definitions (NEW)
│   ├── rateLimit.ts               - Best-effort in-memory rate limiter (NEW)
│   ├── utils.ts                   - Utility functions
│   ├── types.ts                   - TypeScript type definitions
│   └── feature-flags.ts           - Feature toggles
└── public/
    └── countries-110m.json        - World-atlas topology for the ambient
                                      globe (local, not fetched from a CDN)

Key Files (New/Enhanced):
├── app/(app)/weather/page.tsx     - Weather Map Forecast page (NEW)
├── components/weather/WeatherMap.tsx - MapLibre + OWM tile overlay (NEW)
├── app/api/dashboard-stats/route.ts - Dashboard latency fix (NEW)
├── app/(app)/resources/page.tsx   - Documentation links (FIXED)
├── app/(app)/admin/datasets/page.tsx - Search & refresh (ENHANCED)
└── lib/api.ts                     - API client for all endpoints
```

### State Management
- **React Query** (`@tanstack/react-query`) for server state (API data)
- **React Hooks** (`useState`, `useEffect`) for local UI state
- **LocalStorage** for client-side persistence (refresh timestamps, preferences)

### Styling
- **Tailwind CSS v4** with custom design tokens
- **CSS Variables** for theme colors (light/dark mode)
- **No build-time theme extraction** — runtime theme switch via `data-theme` attribute

### New Features Implementation

#### Search Functionality
```typescript
// frontend/app/(app)/admin/datasets/page.tsx
const [searchQuery, setSearchQuery] = useState("");

// Filter logic (lines 206-218)
const filteredSyncEntries = syncEntries.filter((s) =>
  s.source_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
  s.organization.toLowerCase().includes(searchQuery.toLowerCase()) ||
  s.coverage.toLowerCase().includes(searchQuery.toLowerCase()) ||
  s.domains.some((d: string) => d.toLowerCase().includes(searchQuery.toLowerCase()))
);

// Search UI Component (lines 285-308)
<input
  type="text"
  placeholder="Search sources, datasets, agencies..."
  value={searchQuery}
  onChange={(e) => setSearchQuery(e.target.value)}
/>
```

#### Rate-Limited Refresh
```typescript
// Constants (line 22)
const REFRESH_RATE_LIMIT_MS = 60 * 60 * 1000; // 1 hour

// State (lines 103-106)
const [lastRefreshTime, setLastRefreshTime] = useState<number | null>(null);
const [timeUntilRefresh, setTimeUntilRefresh] = useState<number | null>(null);

// Rate limit check (line 131)
const canRefresh = !lastRefreshTime || (Date.now() - lastRefreshTime) >= REFRESH_RATE_LIMIT_MS;

// Refresh handler (lines 133-176)
const handleRefresh = async () => {
  if (!canRefresh) return;
  // Trigger data fetch & store timestamp
  localStorage.setItem(STORAGE_KEY_LAST_REFRESH, now.toString());
};
```

#### "What's New" Display
```typescript
// Storage (lines 23-24)
const STORAGE_KEY_LAST_REFRESH = 'last_sync_refresh_timestamp';
const STORAGE_KEY_SYNC_UPDATES = 'last_sync_updates';

// UI (lines 283-324)
{showUpdates && lastUpdates && (
  <GlassCard className="mb-4 p-5">
    <h3>What's New</h3>
    <div>Last updated: {new Date(lastUpdates.timestamp).toLocaleString()}</div>
    {lastUpdates.changedSources.map((source) => (
      <li key={source.name}>
        <p>{source.name}</p>
        <p>Status: {source.status} · Records: {source.records}</p>
      </li>
    ))}
  </GlassCard>
)}
```

#### Weather Map Forecast (`/weather`, NEW)

Entirely frontend-side — no FastAPI backend involvement. Zoom.Earth was the
original integration target but has no public API and sends
`X-Frame-Options: SAMEORIGIN` (blocks iframe embedding) plus a `robots.txt`
disallowing its internal tile/data paths, so it's a link-out card instead;
live map functionality comes from OpenWeatherMap's free tile API instead.

```
Browser (WeatherMap.tsx, maplibre-gl)
  ↓ tile request: /api/weather-tiles/{layer}/{z}/{x}/{y}
[frontend/lib/rateLimit.ts — 300 req/min per client]
  ↓
[frontend/app/api/weather-tiles/[layer]/[z]/[x]/[y]/route.ts]
  - injects OPENWEATHERMAP_API_KEY server-side (never reaches the browser)
  - Cache-Control: public, max-age=600 (OWM regenerates tiles ~every 10 min)
  ↓
tile.openweathermap.org/map/{layer}/{z}/{x}/{y}.png
```

The raw tiles from that free tier are genuinely pale/low-contrast for typical
(non-extreme) readings. `WeatherMap.tsx` renders them via a MapLibre raster
layer with `raster-opacity: 0.92`, `raster-saturation: 0.6`, and
`raster-contrast: 0.3` — MapLibre-native paint properties that make the same
data read as vividly as OpenWeatherMap's own reference map, with no new data
source or paid tier. A `WeatherLegend` component shows the color scale +
min/max for whichever layer is active. The layer-switching effect gates its
very first `addSource`/`addLayer` call on the map's one-time `"load"` event
(via a ref set exactly once), not on `isStyleLoaded()` — that method reports
false whenever any tile is mid-fetch (true almost constantly during normal
panning), and every layer switch after the first real interaction was
silently discarded when gated on it.

```
Browser (click on map)
  ↓ /api/weather-current?lat=..&lon=..
[frontend/lib/rateLimit.ts — 50 req/min per client]
  ↓
[frontend/app/api/weather-current/route.ts]
  - same OPENWEATHERMAP_API_KEY, proxies OWM's Current Weather API
  ↓
[Page shows a status banner]
  - 503 → key not configured
  - 401 → key configured but not yet active (OWM keys take up to ~2h)
  - network error → generic "couldn't reach" banner
  - otherwise → live temperature/conditions popup
```

---

## Backend Architecture

### Directory Structure

This tree previously described an aspirational `routes/`-package layout that
was never actually built — corrected below to match the real, monolithic
`main.py` structure (verified by direct inspection during the 2026-08-06
audit; see `AUDIT_REPORT.md`).

```
backend/
├── app/
│   ├── main.py                    - FastAPI app: every route is defined
│   │                                 directly here (no routes/ package)
│   ├── config.py                  - Settings — all env vars in one place
│   ├── schemas.py                 - Pydantic request/response models,
│   │                                 including input-validation boundaries
│   │                                 (e.g. SpatialVisionRequest's Base64/
│   │                                 JPEG/size checks)
│   ├── security.py                - RateLimitMiddleware, AuditLogMiddleware,
│   │                                 RBAC role resolution
│   ├── models.py                  - SQLAlchemy ORM models (sync_health,
│   │                                 sync_audit_log, uploaded_datasets, reports)
│   ├── data/
│   │   └── sample_hazards.py      - Curated MVP hazard/event data
│   ├── data_sources/
│   │   ├── connectors/            - Structured-API connectors: GDACS, NASA
│   │   │                             EONET, NASA FIRMS, USGS earthquake,
│   │   │                             ReliefWeb, manual upload
│   │   ├── scrapers/
│   │   │   └── firecrawl_worker.py - Firecrawl advisory scraper → hazard_events
│   │   │                             (PostGIS). No-ops when FIRECRAWL_API_KEY
│   │   │                             is unset. Not yet wired into scheduled
│   │   │                             sync — call scrape_and_upsert() directly
│   │   │                             until it is (see Future Improvements)
│   │   ├── registry/
│   │   │   └── sources_registry.py - Master source registry
│   │   └── sync/                  - Scheduled sync dispatch, health, audit log
│   ├── services/
│   │   ├── providers.py           - LLM abstraction (one OpenAICompatible-
│   │   │                             Provider class shared by Qwen/DeepSeek/
│   │   │                             Together/MiMo/OpenAI, plus GeminiProvider
│   │   │                             and the always-available LocalInsightProvider)
│   │   ├── ai_router.py           - Prompt construction, guardrails
│   │   │                             (validate_output), grounding, deterministic
│   │   │                             local insights
│   │   ├── ask_ai.py              - Ask AI scope guardrails + attribution
│   │   ├── spatial_vision.py      - Multimodal spatial-vision analysis (Qwen-VL)
│   │   │                             for POST /api/ai/spatial-vision — runs
│   │   │                             output through the same validate_output
│   │   │                             guardrail as the text AI endpoints
│   │   ├── risk_scoring.py        - Deterministic risk engine — zero AI/
│   │   │                             provider imports, cannot be influenced
│   │   │                             by generative output (see "Deterministic
│   │   │                             vs. Generative Separation" below)
│   │   ├── geospatial_query.py    - Hazard layer / heatmap GeoJSON
│   │   ├── query_processor.py     - Agent query intent classification
│   │   ├── insights_generator.py  - Grounded risk intelligence insights
│   │   ├── exporters.py           - PDF/CSV export, shareable report storage
│   │   └── dashboard.py           - Deterministic dashboard-stats aggregation
│   └── repositories/              - In-memory or Postgres-backed persistence,
│                                     selected automatically by DATABASE_URL
├── alembic/                       - Migrations: 0001 (foundation tables),
│                                     0002 (hazard_events + PostGIS extension)
├── tests/                         - pytest suite
├── .env.example                   - Environment template (placeholders only)
├── requirements.txt                - Python dependencies
└── runtime.txt                    - Python version pin
```

### Data Flow

#### 1. Risk Assessment Request
```
GET /api/location-risk?lat=12.5&lng=121.0
  ↓
[Input Validation]
  ↓
[Scoring Engine]
  ├─ Earthquake hazard layer
  ├─ Flood hazard layer
  ├─ Volcano hazard layer
  ├─ Cyclone hazard layer
  └─ [Combine into overall score]
  ↓
[Return Risk Model]
{
  "overall": {"score": 0.72, "level": "high", "color": "#ff6b6b"},
  "hazards": {...},
  "coordinates": {...}
}
```

#### 2. Data Sync Flow
```
Daily Cron: GET /api/cron/sync-sources
  ↓
[Verify CRON_SECRET]
  ↓
[Iterate registered sources]
  ├─ GDACS fetch → parse → store
  ├─ NASA EONET fetch → parse → store
  ├─ USGS fetch → parse → store
  └─ ReliefWeb fetch → parse → store
  ↓
[Record sync_health entry]
{
  "source_id": "usgs_earthquakes",
  "last_sync_at": "2026-08-01T16:05:38Z",
  "last_sync_status": "success",
  "records_synced": 1247
}
  ↓
[Frontend displays via /api/sync-health]
{
  "sync_health": [
    {"source_id": "...", "last_sync_at": "...", ...},
    ...
  ]
}
```

#### 3. AI Summary Request
```
POST /api/ai/summary
Body: {lat, lng, name, persona}
  ↓
[Get location risk]
  ↓
[Select AI provider chain]
  Qwen → Together → DeepSeek → OpenAI → Gemini → Local fallback
  (per-task chains in providers.pick_provider; "agent" task additionally
  tries MiMo before DeepSeek — see AI provider routing table in README.md)
  ↓
[Generate grounded summary]
  (Uses risk scores + source data only)
  ↓
[Return AIResponse]
{
  "text": "...",
  "sources": [...],
  "confidence": 0.85
}
```

#### 4. Spatial Vision Request (Multimodal)
```
POST /api/ai/spatial-vision
Body: {user_query, persona, map_image_base64, lat, lng,
       deterministic_scores, active_layers}
  ↓
[Pydantic validation — before any provider call]
  ├─ data:image/jpeg;base64,... prefix required
  ├─ base64 syntax must decode cleanly
  ├─ decoded size bounded: 100 bytes – 1.2MB
  └─ decoded bytes must start with JPEG magic bytes (FF D8)
  ↓
[QWEN_API_KEY unset?] → yes → deterministic local-fallback response,
  same shape as a real one, engine="qwen-vl-local-fallback"
  ↓ no
[Call QWEN_VISION_MODEL via QWEN_BASE_URL, ~15s timeout]
  ↓
[Provider error/timeout/malformed response?] → generic client-safe
  SpatialVisionError (raw provider body logged server-side only, never
  returned to the client) → HTTP 502
  ↓ success
[validate_output() — same guardrail as ai_router's text endpoints]
  ↓
[Return grounded_analysis + official_sources]
```

Client side (`frontend/lib/spatialVision.ts` + `RiskMap.tsx`): the map
canvas (`preserveDrawingBuffer: true`) is downsampled to ≤1024px width,
JPEG-encoded at quality 0.7, and size-checked client-side before the
request is even sent. Requests are cancellable and self-cancelling —  a new
hover, a repeated click, or unmount aborts any prior in-flight request via
`AbortController`, so a stale response can never overwrite a newer one.

### Deterministic vs. Generative Separation

Hazard scores, severity levels, risk categories, and map colors all come
from `services/risk_scoring.py`, which has zero imports from `providers.py`,
`ai_router.py`, or any AI service module — it cannot be influenced by
generative output even in principle. Every AI endpoint (`/api/ai/summary`,
`/api/ai/report`, `/api/agent/query`, `/api/ai/spatial-vision`) computes the
deterministic risk first and merges it as `{"risk": risk, **ai_result}`;
`ai_result` (from `generate_insight`/`analyze_spatial_viewport`) never
contains a `risk` key, so AI output structurally cannot overwrite the scored
result. Provider failures (timeout, error, malformed response) raise
provider-specific exceptions that are caught and translated into safe HTTP
responses — they never propagate into or block the scoring path, and
`score_location()` itself makes no network calls.

### API Response Models

#### Sync Health Response
```python
class SyncHealthEntry(BaseModel):
    source_id: str                           # Unique ID
    source_name: str                         # Human-readable
    organization: str                        # Agency/org
    coverage: str                            # Geographic
    domains: List[str]                       # Risk domains
    access_type: str                         # API/RSS/CSV
    trust_level: int                         # 1-5
    confidence_category: str                 # High/Medium/Low
    enabled: bool
    auto_sync_enabled: bool
    sync_frequency_minutes: Optional[int]
    last_sync_at: Optional[datetime]
    last_successful_sync_at: Optional[datetime]
    last_sync_status: Optional[str]          # success/failed/partial
    records_synced: int
    error: Optional[str]
    is_stale: bool
    source_url: str
    docs_url: Optional[str]
    requires_api_key: bool
    requires_registration: bool
    license_notes: Optional[str]
```

---

## Authentication & Authorization

### Current State (Before Real Auth)
- **RBAC Header**: `X-Role` (client-supplied, not secure)
- **Admin Secret**: `ADMIN_SHARED_SECRET` for elevated operations
- **CORS**: Restricted to frontend origin

### Roles & Capabilities
```
public_user
  ├─ Read: risk assessments, reports, datasets
  ├─ Access: map, dashboard, AI workspace
  └─ Denied: admin operations

analyst
  ├─ Above +
  ├─ Requires: ADMIN_SHARED_SECRET
  └─ Access: sync status, manual refresh

dataset_admin
  ├─ Above +
  ├─ Requires: ADMIN_SHARED_SECRET
  └─ Mutate: dataset registration

super_admin
  └─ All operations
```

### Known Limitation
**RBAC is not real authentication.** There is no login; anyone can claim any role.
The `ADMIN_SHARED_SECRET` blocks opportunistic third-party abuse but is one static
secret, not per-user identity. Real JWT/OAuth authentication is not yet built.

---

## Rate Limiting

### Client-Side (Frontend)
```typescript
// Refresh rate limiting (1 hour)
const REFRESH_RATE_LIMIT_MS = 60 * 60 * 1000;
const canRefresh = (Date.now() - lastRefreshTime) >= REFRESH_RATE_LIMIT_MS;
```

### Server-Side (Backend)
```python
# Sliding-window rate limiting (security.py)
# Tighter budget for AI endpoints (/api/ai/*, /api/agent/*)
# Standard budget for data endpoints (/api/location-risk, etc.)
```

### Usage Quotas (Backend, separate from rate limiting above)
```python
# app/services/usage_quota.py — long-window, per-IP, in-memory (same
# single-instance caveat as RateLimitMiddleware; swap for Redis in
# multi-instance deployments). Two tiers:
#   "insights": sliding window, INSIGHTS_QUOTA_LIMIT per INSIGHTS_QUOTA_WINDOW
#               seconds (default 3 per 5h). Enforced on
#               POST /api/generate-insights.
#   "chat":     calendar-day (UTC midnight reset), CHAT_QUOTA_LIMIT/day
#               (default 50). Enforced on POST /api/ask-ai (AI Agent panel)
#               AND POST /api/agent/query (AI Workspace) — same bucket,
#               shared budget across both surfaces.
# GET /api/usage-status reports both tiers' current status without
# consuming a hit; drives the UsageMeter component shown in the UI.
```

### Server-Side (Frontend Route Handlers)
```typescript
// frontend/lib/rateLimit.ts — best-effort in-memory sliding window, relies
// on Vercel Fluid Compute reusing function instances (not distributed, but
// enough to stop a single client or hot-linker from draining a shared,
// quota-capped upstream key). Key is namespaced per route (clientKeyFromRequest
// takes a `namespace` arg) so different routes don't share one bucket, and
// trusts the LAST X-Forwarded-For entry (Vercel's own edge), not the first
// (client-spoofable). Applied to the OpenWeatherMap proxy routes:
// weather-tiles/[layer]/[z]/[x]/[y]  → 300 req/min (a viewport pans/zooms
//                                       across dozens of tiles at once)
// weather-current                    → 50 req/min
```

---

## Environment Variables

### Frontend (.env.local / Vercel env vars)
```env
NEXT_PUBLIC_API_URL=https://resiliencemap-api.onrender.com  # Backend URL
NEXT_PUBLIC_MAP_STYLE=https://...                           # MapLibre style
OPENWEATHERMAP_API_KEY=...                                  # Optional — server-only,
                                                             # powers /weather tile layers.
                                                             # Without it the page still
                                                             # renders with a notice.
```

### Backend (.env.local)
```env
# Required for production
DATABASE_URL=postgresql://...                               # PostgreSQL (Neon)
CRON_SECRET=...                                             # Vercel cron auth
ADMIN_SHARED_SECRET=...                                     # Admin operations

# Usage quotas (long-window, per-IP — see Rate Limiting section above)
INSIGHTS_QUOTA_LIMIT=3                                       # Insights generations per window
INSIGHTS_QUOTA_WINDOW=18000                                  # Window in seconds (default 5h)
CHAT_QUOTA_LIMIT=50                                          # AI Agent panel + AI Workspace,
                                                              # shared daily cap (resets UTC midnight)

# Optional: AI providers (fallback to local if absent — no provider key is
# actually "required"; get_settings() only warns if none at all is set)
QWEN_API_KEY=...                                            # Alibaba Cloud Model
QWEN_BASE_URL=...                                            # Studio/DashScope. Workspace-
                                                             # scoped keys need a custom
                                                             # QWEN_BASE_URL, not the
                                                             # dashscope-intl.aliyuncs.com
                                                             # default.
QWEN_VISION_MODEL=qwen3-vl-flash                            # Vision-capable Qwen model,
                                                             # used only by POST /api/ai/
                                                             # spatial-vision. Shares
                                                             # QWEN_API_KEY/QWEN_BASE_URL.
TOGETHER_API_KEY=...                                        # Together AI — open-weight
                                                             # models, managed fine-tuning API
DEEPSEEK_API_KEY=...
OPENAI_API_KEY=...
GEMINI_API_KEY=...
MIMO_API_KEY=...
FIRECRAWL_API_KEY=...                                       # Optional — powers the Firecrawl
                                                             # advisory scraper worker
                                                             # (data_sources/scrapers/). Worker
                                                             # safely no-ops when unset; also
                                                             # requires DATABASE_URL with
                                                             # PostGIS for the hazard_events
                                                             # table it writes to.

# Note: GDACS and ReliefWeb connectors (data_sources/connectors/) fetch
# public feeds and take no API key — a prior "GDACS_API_KEY"/
# "RELIEFWEB_API_KEY" listing here didn't correspond to any actual
# config.py setting or connector code; removed during the 2026-08-06 audit.
```

---

## Deployment Architecture

### Frontend (Vercel)
- Git-connected to `main` branch
- Auto-deploy on push (unreliable; use `vercel deploy --prod` for production)
- Environment variables: NEXT_PUBLIC_API_URL
- **Critical**: Must point to the backend URL; if empty, all API calls 404
- **Page HTML caching (Aug 6, 2026)**: all page routes (excludes
  `/_next/*`, `/api/*`, and any path with a file extension) get
  `Cache-Control: no-cache, no-store, must-revalidate` via
  `next.config.ts`'s `headers()` — deliberately stricter than Next's own
  default `max-age=0, must-revalidate`, so no browser/proxy can serve a
  cached HTML shell referencing removed `_next/static` chunk hashes from
  a prior deployment. `_next/static/*` remains `immutable` (Next enforces
  this, cannot be overridden) — only the HTML shell trades a cache hit for
  guaranteed freshness on every navigation.

### Backend (Render)
- Git-connected to `main` branch
- Auto-deploy on push
- Environment variables: DATABASE_URL, CRON_SECRET, ADMIN_SHARED_SECRET, AI keys
- **Critical**: Python version pinned in `runtime.txt` (prevents silent incompatibilities)
- **Free tier**: Spins down with inactivity (50s+ cold start)

### Database (Neon via Vercel Marketplace)
- Optional (demo works without it; in-memory fallback)
- PostgreSQL with built-in backup/replication
- Alembic migrations applied out-of-band (never automatic in serverless)

### Cron Scheduling (Vercel)
- Daily sync at 00:00 UTC
- Hits `GET /api/cron/sync-sources` (authenticated by CRON_SECRET)
- Hobbyplan: 1x daily max; upgrade to Pro for more frequent sync

---

## Monitoring & Logging

### Frontend Logging
- Browser console (dev tools)
- Vercel Analytics (page views, performance)
- No backend logging of frontend events (privacy)

### Backend Logging
```python
# All /api routes logged
# Format: timestamp | method | path | status | duration_ms | user_role

# Example:
# 2026-08-01 16:05:38 | GET | /api/location-risk | 200 | 42ms | public_user
```

### Sync Health Endpoint
```
GET /api/sync-health
Returns:
{
  "sync_health": [
    {
      "source_id": "usgs_earthquakes",
      "last_sync_at": "2026-08-01T16:05:38Z",
      "last_sync_status": "success",
      "records_synced": 1247,
      "is_stale": false,
      ...
    },
    ...
  ]
}
```

---

## Performance Considerations

### Frontend
- Lazy-load map (MapLibre GL) only when `/map` or `/weather` is visited
- Code-split AI features (`/agents`, `/api/ai/*`)
- Image optimization (Next.js Image component)
- Ambient globe hidden on small viewports; world-atlas data served from a
  local static asset instead of an external CDN (was unreliable — see
  "Recent fixes" in README.md)
- Respects `prefers-reduced-motion`
- `dashboard-stats` cached same-origin (`unstable_cache`, 60s window) so the
  Render backend's cold/slow connection setup doesn't block every dashboard
  load — only the first request per window pays that cost

### Backend
- Endpoint-specific rate limiting (tighter for AI)
- Cached source registry (regenerate after `sources_registry.py` edits)
- Prompt injection detection (flagged input treated as data)
- Database connection pooling (if using Postgres)
- **Spatial-vision token/payload mitigation** — image resizing (max
  1024px width), JPEG compression (quality 0.7), client- and server-side
  payload validation (decoded size bounded 100 bytes–1.2MB, JPEG magic-byte
  check), a ~15s provider timeout, and request cancellation via
  `AbortController` so an abandoned request doesn't keep consuming quota.
  Typical viewport snapshots land well under 150KB at these settings — an
  observed range from manual testing, not an enforced ceiling; nothing in
  the code rejects a snapshot between 150KB and the 1.2MB hard limit.

### Network
- Gzip compression (Next.js + FastAPI default)
- Cache-Control headers on static assets
- API responses cached in React Query (stale-while-revalidate)

---

## Development Workflow

### Local Setup
```bash
# Backend
cd backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn app.main:app --reload --port 8000

# Frontend (in another terminal)
cd frontend
npm install
npm run dev
```

### Making Changes
1. **Backend changes**: Changes auto-reload via `--reload` flag
2. **Frontend changes**: Next.js hot-reloads on save
3. **Database schema**: Use Alembic (`alembic revision --autogenerate -m "message"`)

### Testing
```bash
cd backend
.venv/bin/python -m pytest tests/ -q
```

### Deployment Workflow
1. Push to `main` branch
2. Both Vercel and Render auto-deploy
3. Verify deployment with `vercel ls` and `vercel deploy --prod` if needed
4. **Important**: Check `NEXT_PUBLIC_API_URL` on Vercel (points to backend)

---

## Security Checklist

- [ ] All AI calls server-side (no keys in browser)
- [ ] Pydantic validation on all inputs
- [ ] Rate limiting on AI endpoints
- [ ] Audit logging on all `/api` routes
- [ ] CORS restricted to frontend origin
- [ ] CRON_SECRET protects scheduled sync
- [ ] ADMIN_SHARED_SECRET protects admin operations
- [ ] Environment variables (keys, secrets) not committed
- [ ] Database credentials use connection pooling
- [ ] HTTPS enforced (Vercel + Render both require it)

---

## Future Improvements

1. **Real Authentication**: JWT/OAuth instead of X-Role header
2. **Per-User Rate Limiting**: Track by user ID, not IP
3. **WebSocket Support**: Real-time sync notifications
4. **GraphQL**: Consider for complex data queries
5. **Offline Mode**: Service Worker caching for offline risk assessments
6. **Mobile App**: React Native wrapper around existing API
7. **Multi-Language**: i18n for international users
8. **Wire the Firecrawl scraper into scheduled sync**: `firecrawl_worker.py`
   is implemented and tested but not yet registered in
   `data_sources/sync/run_source_sync.py` — currently must be invoked
   directly. Wiring it in needs a registry entry, a real Firecrawl account,
   and a live PostGIS-enabled database to verify end-to-end (none of which
   were available during the 2026-08-06 audit — see `AUDIT_REPORT.md`).
9. **Coordinated Starlette/FastAPI upgrade**: `starlette==0.52.1` (pulled in
   by `fastapi==0.128.8`) has published CVEs around Host-header/path
   reconstruction (PYSEC-2026-161/248/249/2280/2281). The one path this app
   actually exercises (`request.url.path` for rate-limit tiering and audit
   logging) was hardened directly (see `app/security.py` — now reads
   `request.scope["path"]` instead), but the dependency itself remains
   outdated; a coordinated upgrade to a compatible fastapi+starlette pair
   was judged too broad for a targeted audit fix.

