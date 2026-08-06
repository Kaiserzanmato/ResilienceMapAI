# ResilienceMap AI - Product Requirements Document (PRD)

**Version**: 2.3 (Aug 2026)  
**Status**: ACTIVE - Weather Forecast Integration + AI Provider Diversification + Map Spatial Vision  
**Last Updated**: 2026-08-06  
**Owner**: DocypherLabs  

---

## Executive Summary

ResilienceMap AI is an AI-powered disaster risk intelligence platform that combines authoritative global hazard data with explainable AI insights. Users can assess geographic risk, compare locations, generate executive reports, and access a curated registry of 45+ disaster risk datasets.

**August 2026 Enhancement**: Introduces smart data management features (search, rate-limited refresh, update transparency) to improve usability and protect backend infrastructure.

**August 2026 Enhancement (cont'd)**: Adds a Weather Map Forecast tab (live
OpenWeatherMap tile layers + current-conditions lookup), diversifies AI
provider routing beyond DeepSeek (Qwen/Alibaba Cloud Model Studio and
Together AI now lead the routing chain, both chosen for open-weight
fine-tuning support), and fixes three reliability issues: dashboard load
latency caused by the backend's free-tier cold starts, inconsistent ambient
globe rendering caused by an external CDN dependency, and an AI-provider
status display that was hardcoded regardless of actual configuration.

---

## Product Vision

**Mission**: Empower organizations to make informed decisions about disaster risk through accurate, current, and AI-explained intelligence.

**Core Values**:
- **Accuracy**: No invented predictions; explain existing data only
- **Transparency**: Show data sources and methodology
- **Accessibility**: Work without premium AI services (local fallback)
- **Reliability**: Protect infrastructure with rate limiting and audit trails

---

## Key Features (Current)

### 1. Interactive Hazard Mapping (`/map`)
**Purpose**: Visualize disaster risk across six map styles

**Features**:
- 6 map views: Standard, Satellite, Terrain, Hybrid, Dark, Light
- Real-time hazard layer overlays (earthquake, flood, volcano, cyclone, etc.)
- Heatmap density visualization
- Active alert markers with click-to-assess
- Historical event timeline
- Floating widget panels
- Animated zoom-to-location
- Global location search through the server-side geocoder gateway. Geoapify is
  the primary provider; LocationIQ is attempted when the primary has no result
  or fails, with optional Photon and local-gazetteer fallback. Candidates show
  their normalized address and require explicit user selection before
  assessment. Property and venue results are provider-dependent and may be
  broad or incorrect; the product must not claim address-verification quality.
- Registry-driven multi-hazard screening through `POST /api/assessments`.
  Each supported hazard exposes score, source, and confidence or an explicit
  `null` no-data state. An overall score requires at least two numeric hazards.
- **Hover telemetry** — debounced (40ms) card showing coordinates and, when
  hovering a rendered risk zone, its name/country/score/level/population
  (`frontend/lib/mapHoverTelemetry.ts`) **(NEW Aug 2026)**
- **Spatial Vision ("Analyze with AI")** — sends an optimized map snapshot
  plus deterministic risk context to a vision-capable Qwen model
  (`POST /api/ai/spatial-vision`) for a grounded, persona-tailored analysis;
  falls back to a deterministic response when no provider key is configured
  **(NEW Aug 2026)**

**Technical**: MapLibre GL JS, GeoJSON hazard layers, vector tiles

**Performance Target**: <200ms layer render, <500ms zoom animation

**Global-search acceptance criteria**:
- A search request never exposes provider credentials.
- The selected candidate's displayed address and coordinates are visible before
  its risk assessment is used.
- Provider failures yield a safe diagnostic and bounded fallback, not a 500.
- Unsupported coverage remains `null`; it must never be shown as low risk.

---

### 2. Executive Dashboard (`/dashboard`)
**Purpose**: High-level KPI view for decision makers

**Displays**:
- Global risk summary cards (% countries in danger, active alerts)
- Regional risk rankings (by country/region)
- Hazard-specific trends (earthquakes, floods, etc.)
- Temporal charts (last 7 days, 30 days, 90 days)
- Active event counter and severity breakdown

**Technical**: Recharts, responsive grid layout. Stats are served through a
same-origin cached proxy (`unstable_cache`, 60s window) rather than fetched
directly from the backend on every load — the Render free tier's cold/slow
connection setup (measured 3.0s → 1.0s → 0.07s across successive requests,
occasionally 20s+ on a fully cold instance) was otherwise the dominant
source of dashboard load latency.

**Performance Target**: <1s page load, <100ms chart interaction

---

### 3. AI Workspace (`/agents`)
**Purpose**: Conversational intelligence assistant

**Features**:
- Persona selection (Citizen, Analyst, Policy Maker)
- Multi-turn conversations
- Source-grounded responses (all claims cite data)
- Location context (current map view or typed address)
- Export conversation to PDF
- Shared 50/day usage quota with the map nav's AI Agent panel (both draw
  from one budget, resets at UTC midnight); a usage meter shows remaining
  requests and blocks new messages before sending once exhausted, rather
  than failing silently or only after a wasted round-trip (NEW Aug 2026)

**Personas**:
- **Citizen**: Accessible language, focus on personal safety
- **Analyst**: Technical detail, metrics, confidence intervals
- **Policy Maker**: Strategic implications, options for action

**Technical**: LLM routing (Qwen → MiMo → Together → DeepSeek → OpenAI →
Gemini → local fallback for agent queries; see README.md for the full
per-task routing table). Qwen (Alibaba Cloud Model Studio) and Together AI
were added Aug 2026 specifically because both support fine-tuning
open-weight models on custom data, unlike a closed hosted-only API. The
displayed "AI Engine" label on this page reflects whichever provider will
actually answer — it used to be hardcoded to always show "DeepSeek".

**Performance Target**: <5s response (with streaming), <2s local fallback

---

### 4. Report Generation (`/reports`)
**Purpose**: Create exportable intelligence briefs

**Formats**:
- PDF: Executive summary + hazard breakdown + charts
- CSV: Raw data export (location coordinates, hazard scores, metadata)

**Features**:
- Customizable recipient/agency name
- Date stamp and disclaimer
- Share link (30-day expiry)
- Batch download (multiple locations)

**Technical**: ReportLab (PDF), CSV writer, signed URLs (optional)

**Performance Target**: <3s PDF generation, <2s CSV export

---

### 5. Documentation & Resources (`/resources`)
**Purpose**: User education and data source discovery

**Sections**:
- Getting Started guide (with working links)
- Risk Scoring Methodology explanation
- API Reference documentation
- Data Sources catalog (45+ indexed sources)
- Research Datasets list
- Contact & Support links

**New (Aug 2026)**:
- "Learn more" links now functional → open documentation in new tabs
- "View Full Dataset" button → navigates to `/admin/datasets`
- Data Accuracy Notice fully responsive (no text cutoff)

**Performance Target**: <1s page load, instant navigation

---

### 6. Dataset Management (`/admin/datasets`)
**Purpose**: Administer data sources and sync health

**Features**:

#### A. Source Registry Tab
- Grid view of 45 registered data sources
- Per-source metadata:
  - Name, organization, coverage area
  - Trust level (1-5 scale: Official > UN-backed > Research > Specialized > Manual)
  - Sync frequency, last sync timestamp, record count
  - Links to source website and documentation
  - Status badges (stale, disabled, API-key-required, etc.)

#### B. Search Functionality **(NEW Aug 2026)**
- Real-time filter across:
  - Source name (e.g., "USGS")
  - Organization (e.g., "European Commission")
  - Coverage (e.g., "Global", "Regional")
  - Domains (e.g., "natural_hazards", "conflict")
- Live result count
- Clear search (X button)

#### C. Smart Refresh Button **(NEW Aug 2026)**
- Triggers manual data sync
- **Rate limiting**: Max 1 refresh per hour
  - Protects backend from accidental/malicious spam
  - Shows countdown timer when limited ("45m 30s remaining")
- **Timestamp display**:
  - Shows exact time of last successful sync
  - Format: "Last updated: 8/1/2026, 4:05:38 PM"
  - Uses user's local timezone
  - Persistent across page reloads (localStorage)

#### D. "What's New" Button **(NEW Aug 2026)**
- Toggle panel showing update details
- Per-source information:
  - Source name
  - Sync status (success, failed, partial)
  - Record count (e.g., "1,247 records")
  - Last successful sync timestamp
  - Visual indicators (✓ success, ⚠ warnings)
- Automatic diffing: shows only changed sources
- Stored in localStorage, survives page reload

**Technical**: React Query, localStorage, JSON diffing

**Performance Target**: <500ms filter, <1s "What's New" panel

---

### 7. User Settings (`/settings`)
**Purpose**: Personalize the platform

**Options**:
- Theme: Light / Dark / System / High Contrast
- Default persona for AI (Citizen / Analyst / Policy Maker)
- Default map style preference
- Language (future: currently English-only)

**Technical**: Context + localStorage, CSS custom properties

**Performance Target**: <100ms theme switch

---

### 8. Weather Map Forecast (`/weather`) **(NEW Aug 2026)**
**Purpose**: Live satellite/weather visualization alongside the deterministic
hazard map

**Features**:
- Live tile layers: Precipitation, Clouds, Wind, Temperature, Pressure
  (OpenWeatherMap free tier), rendered with boosted saturation/contrast so
  the free tier's naturally pale colors read as clearly as a paid product's
- Color-scale legend (gradient + min/max) for whichever layer is active
- Click anywhere on the map for current conditions (temperature, feels-like,
  humidity, wind) at that point
- Link-out card to Zoom.Earth for full satellite/storm-tracking view

**Why a link-out instead of an embed**: Zoom.Earth has no public API and
sends `X-Frame-Options: SAMEORIGIN`, which blocks iframe embedding outright;
its `robots.txt` also disallows the internal paths its own map relies on.
Building a real in-app map on a legitimate, documented free API
(OpenWeatherMap) was the alternative, with Zoom.Earth linked out for users
who want its specific storm-tracking view.

**Technical**: MapLibre GL (same stack as `/map`), server-side tile/current-
conditions proxies (`frontend/app/api/weather-tiles/`,
`frontend/app/api/weather-current/`) keep `OPENWEATHERMAP_API_KEY` out of
the browser and apply best-effort rate limiting to protect the shared,
quota-capped key (free tier: 60 calls/min, 1M/month)

**Performance Target**: <1s initial tile paint, <2s current-conditions lookup

---

## User Flows

### Flow 1: Assess Risk for a Single Location

```
User starts on landing page
    ↓
Clicks "Assess Risk" or navigates to /map
    ↓
Searches address in map search bar (or clicks a location)
    ↓
[Hazard layers load, risk score calculated]
    ↓
Risk card appears (score + color + breakdown by hazard type)
    ↓
User can:
    ├─ Click "Get AI Summary" → /agents (with location context)
    ├─ Click "Export Report" → generate PDF/CSV
    ├─ Share location → get 30-day share link
    └─ Compare with other locations → /map comparison mode
```

**Time to Risk Assessment**: <2s (map render + scoring)

---

### Flow 2: Search and Filter Data Sources

```
User navigates to /admin/datasets
    ↓
Sees "Source Registry (45)" tab selected
    ↓
Types in search box: "USGS"
    ↓
[Page filters in real-time]
    ↓
Displays 3 matching sources:
    ├─ USGS Earthquake Hazards Program
    ├─ USGS Volcano Disaster Assistance Program
    └─ USGS Flood Inundation Forecast System
    ↓
Sees result count: "3 source(s) found"
    ↓
User can:
    ├─ Click source card → open website
    ├─ Clear search (X button) → reset to all 45
    └─ Scroll through filtered results
```

**Time to Filter**: <100ms

---

### Flow 3: Refresh Data with Rate Limiting

```
User is on /admin/datasets
    ↓
Sees "Last updated: 8/1/2026, 4:05:38 PM" with timestamp
    ↓
Clicks "Refresh" button
    ↓
[Button shows "Refreshing..." with spinner]
[Backend fetches latest from GDACS, NASA, USGS, ReliefWeb]
[Sync audit log updated]
    ↓
Button re-enables, new timestamp appears:
    "Last updated: 8/1/2026, 4:06:15 PM (Next refresh in 59m 45s)"
    ↓
User tries to refresh again immediately
    ↓
Button is DISABLED with tooltip:
    "Rate limited. Refresh available in 59m 44s"
    ↓
User can click "What's New" to see update details:
    ├─ USGS Earthquake Hazards Program
    │   Status: success
    │   Records: 1,247
    │   Last sync: 8/1/2026, 4:06:12 PM
    ├─ NASA EONET
    │   Status: success
    │   Records: 89
    │   Last sync: 8/1/2026, 4:05:58 PM
    └─ [No changes] ReliefWeb (same as before)
```

**Time to Refresh**: <3s (backend sync), <500ms (UI update)

---

### Flow 4: Generate and Share a Report

```
User on /map with a location selected
    ↓
Clicks "Export" → "Generate Report"
    ↓
Modal appears:
    ├─ Recipient name (optional)
    ├─ Agency (optional)
    ├─ Format: PDF / CSV
    └─ [Generate] button
    ↓
[Backend generates PDF/CSV]
    ↓
Browser downloads file
    ↓
User can optionally create share link:
    Clicks "Share" → 30-day link created
    → URL: resilience-map-ai.vercel.app/report/xyz789
    ↓
User copies link, sends to stakeholders
    ↓
Stakeholders open link, see:
    ├─ Executive summary
    ├─ Risk scores + charts
    ├─ Data sources + disclaimer
    └─ Generated timestamp
```

**Time to PDF**: <3s  
**Time to Share Link**: <1s

---

## Non-Functional Requirements

### Performance
| Metric | Target | Notes |
|--------|--------|-------|
| Landing page load | <2s | Lighthouse >80 |
| Map render | <200ms | First layer visible |
| Risk calculation | <500ms | Scoring engine |
| API response | <1s | 95th percentile |
| Search filter | <100ms | Real-time responsiveness |
| Refresh sync | <3s | Backend + UI update |
| PDF export | <3s | Average document |

### Scalability
- Support 1,000 concurrent users on Vercel (auto-scales)
- Backend: Render free tier (can upgrade to Pro)
- Database: Neon with auto-scaling (optional)
- Daily data sync: <5 min total (parallel fetches)

### Reliability
- 99.5% uptime target (Vercel SLA)
- Graceful degradation if backend unavailable (local fallback for AI)
- Automated daily data sync with audit logging
- Database automatic backup (Neon)

### Security
- All AI keys server-side (no browser secrets)
- HTTPS enforced (Vercel + Render)
- CORS restricted to frontend origin
- Pydantic validation on all inputs
- Rate limiting on AI and refresh endpoints
- Long-window usage quotas (separate from rate limiting), per-IP: Insights
  3/5h; AI Agent panel + AI Workspace chat share 50/day
- Audit logging on all data mutations

### Accessibility
- WCAG 2.1 Level AA compliance
- Keyboard navigation throughout
- Dark mode with high-contrast option
- Respect `prefers-reduced-motion`
- Alt text on all meaningful images
- Semantic HTML (`<button>`, `<nav>`, `<main>`)

### Responsiveness
- **Mobile** (320px): Single-column, bottom navigation
- **Tablet** (768px): Two-column, top navigation
- **Desktop** (1024px+): Three-column, full layout
- **Ultra-wide** (1920px+): Content width capped at 1400px

---

## Success Metrics

### User Engagement
- Monthly active users
- Average session duration
- Features used per session
- Search query popularity (top domains/agencies)

### Data Quality
- Sync success rate (% sources updated daily)
- Data staleness (% sources >1 day old)
- Records per source (trending over time)

### Platform Reliability
- API uptime (% successful requests)
- Refresh success rate (how often sync completes)
- Error rate (<0.1% target)
- P95 response time (<1s target)

---

## Constraints & Assumptions

### Constraints
- **No login required** (RBAC via headers, not authenticated users)
- **One static admin secret** (not per-user; limits admin UI to insiders)
- **Single data source of truth**: `sources_registry.py` in backend
- **Daily sync only** on Vercel Hobby plan (upgrade to Pro for more frequent)
- **No offline mode** (yet; requires service worker caching)

### Assumptions
- **Users trust official sources**: GDACS, USGS, NASA, etc.
- **Internet always available**: Hybrid offline mode not prioritized
- **English-speaking audience**: No i18n initially
- **Desktop-first design**: Mobile is secondary (but responsive)
- **No user accounts needed**: Shareable links replace user history

---

## Roadmap (Future Priorities)

### Q3 2026
- ✅ Search & filter data sources (DONE - Aug 2026)
- ✅ Rate-limited refresh (DONE - Aug 2026)
- ✅ "What's New" transparency (DONE - Aug 2026)
- ✅ Weather Map Forecast tab — OpenWeatherMap tiles + Zoom.Earth link-out
  (DONE - Aug 2026)
- ✅ AI provider diversification — Qwen (Model Studio) + Together AI added,
  both with fine-tuning support on custom data (DONE - Aug 2026)
- ✅ Dashboard latency fix — same-origin cached proxy insulates the app from
  the Render free tier's cold-start behavior (DONE - Aug 2026)
- ✅ Map hover telemetry + Spatial Vision ("Analyze with AI") — code
  complete, unit/integration tested, live-verified end-to-end against the
  real Qwen VL API and in a browser against the local dev app; **not yet
  deployed to production Vercel/Render at time of writing** (DONE - Aug 2026,
  see `AUDIT_REPORT.md` for the verification evidence and what remains)
- 🚧 Firecrawl advisory scraper — worker implemented, unit tested (mocked),
  PostGIS migration written; **not wired into scheduled sync, and never run
  against a live Firecrawl account or a real PostGIS database** — treat as
  code-complete-but-unverified-in-production, not DONE (Aug 2026)
- [ ] Mobile app (React Native wrapper)
- [ ] Real authentication (JWT/OAuth)
- [ ] Fine-tune a Qwen model on ResilienceMap's own risk-summary data via
  Model Studio or Together AI (infrastructure now in place; no training run
  has been executed yet)

### Q4 2026
- [ ] WebSocket for real-time sync notifications
- [ ] Per-user rate limiting (track by user ID)
- [ ] Offline mode (service worker caching)
- [ ] Advanced analytics dashboard
- [ ] API key management (for external integrations)

### 2027
- [ ] GraphQL endpoint
- [ ] Multi-language support (i18n)
- [ ] Custom data source connectors (no-code UI)
- [ ] Predictive modeling (based on historical trends)
- [ ] Integration with emergency management systems

---

## Stakeholders & Approval

| Role | Name | Approval | Date |
|------|------|----------|------|
| Product Manager | [Your Name] | Pending | - |
| Engineering Lead | [Your Name] | Pending | - |
| Design Lead | [Your Name] | Pending | - |
| Security | [Your Name] | Pending | - |

---

## Appendices

### A. Data Source Registry (45 Sources)

**Active Connectors (4)**:
1. GDACS - Global Disaster Alert & Coordination System
2. NASA EONET - Earth Observation Natural Event Tracker
3. USGS - Earthquake Hazards Program
4. ReliefWeb - Humanitarian Data Exchange

**Registry Only (41 sources, awaiting connectors)**:
- WRI - World Risk Index
- INFORM - Humanitarian Risk Index
- ND-GAIN - Climate Vulnerability Index
- FAO - Food and Agriculture Organization
- IPC - Integrated Food Security Phase Classification
- [... and 36 more]

### B. Risk Score Scale

| Score Range | Level | Color | Meaning |
|---|---|---|---|
| 0.0 - 0.3 | Low | Green (#27ae60) | Minimal threat |
| 0.3 - 0.5 | Moderate | Yellow (#f39c12) | Watch closely |
| 0.5 - 0.7 | High | Orange (#e67e22) | Significant threat |
| 0.7 - 0.9 | Very High | Red (#e74c3c) | Immediate concern |
| 0.9 - 1.0 | Critical | Dark Red (#8b0000) | Emergency conditions |

### C. API Endpoint Summary

| Endpoint | Purpose | Rate Limit |
|---|---|---|
| GET /api/location-risk | Risk assessment | Standard |
| POST /api/compare-locations | Multi-location comparison | Standard |
| GET /api/hazard-layers | Hazard data (GeoJSON) | Standard |
| POST /api/ai/summary | AI-powered insights | **Tight** |
| POST /api/ai/spatial-vision | Multimodal map-viewport analysis (NEW Aug 2026) | **Tight** |
| POST /api/agent/query | Conversational assistant (AI Workspace) | **Tight** + chat quota¹ |
| POST /api/ask-ai | Conversational assistant (map nav AI Agent panel) | **Tight** + chat quota¹ |
| POST /api/generate-insights | Location risk insights | insights quota¹ |
| GET /api/usage-status | Current quota status (NEW Aug 2026) | Standard |
| GET /api/sync-health | Sync status & timestamps | Standard |
| POST /api/data-sync | Manual refresh | **Tight** |
| GET /api/cron/sync-sources | Scheduled sync (daily) | Admin-only |

¹ Usage quota (NEW Aug 2026): long-window, per-IP, separate from the
short-window "Tight" burst limit above — see Security NFR and
ARCHITECTURE.md's Rate Limiting section. Chat quota (50/day) is shared
between `/api/ask-ai` and `/api/agent/query`; insights quota (3/5h) is
independent.

#### POST /api/ai/spatial-vision — detail

- **Purpose**: Ground a vision-capable model's analysis in an actual
  rendered map viewport (not just coordinates), for a persona-tailored,
  source-cited assessment.
- **Inputs**: `user_query`, `persona`, `map_image_base64` (JPEG data URL),
  `lat`/`lng`, `deterministic_scores`, `active_layers`.
- **Outputs**: `grounded_analysis` (text, passed through the same
  `validate_output()` guardrail as other AI endpoints), `official_sources`,
  optionally `actionable_recommendations`.
- **Authentication**: none beyond the app's existing per-IP rate limiting —
  same posture as the other public AI endpoints; no admin/RBAC gate.
- **Rate limits**: shared "tight" AI-endpoint bucket
  (`AI_RATE_LIMIT_REQUESTS`, default 20/60s per IP).
- **Error states**: malformed/oversized/non-JPEG image → `422` before any
  provider call; provider timeout/error/rate-limit/malformed response →
  `502` with a generic message (raw provider output is logged server-side
  only, never returned to the client).
- **Payload limits**: request body capped at ~1.5MB of base64 (~1.1MB
  decoded); server additionally rejects anything decoding outside
  100 bytes–1.2MB or without a JPEG magic-byte prefix. Client-side, the
  snapshot itself is capped at 1024px width / JPEG q0.7 before it's ever
  sent — typically well under 150KB in practice, though that figure is
  observed, not enforced.
- **Provider fallback behavior**: when `QWEN_API_KEY` is unset, returns a
  deterministic local response in the same shape (`engine:
  "qwen-vl-local-fallback"`) rather than failing — matches the text AI
  endpoints' fallback pattern.
- **Privacy/security**: the map snapshot and query are sent to Alibaba
  Cloud (DashScope) when a key is configured; no user PII is collected by
  this endpoint beyond what's visible in the rendered map itself
  (coordinates, hazard overlays).

Backend endpoints above are FastAPI (Render). The frontend also exposes its
own same-origin Route Handlers (Vercel Functions) for caching and secret
handling, not part of the FastAPI backend:

| Endpoint (frontend) | Purpose | Rate Limit |
|---|---|---|
| GET /api/dashboard-stats | Cached proxy to backend dashboard stats | 60s cache window |
| GET /api/weather-tiles/[layer]/[z]/[x]/[y] | OpenWeatherMap tile proxy | 300/min per client |
| GET /api/weather-current | OpenWeatherMap current-conditions proxy | 50/min per client |
| POST /api/admin/datasets/upload | RBAC-secret-holding upload proxy | Standard |

### D. Glossary

- **Hazard**: Natural disaster type (earthquake, flood, etc.)
- **Risk**: Combination of hazard probability, exposure, and vulnerability
- **Sync**: Automatic data fetch from external sources (daily)
- **Rate Limiting**: Restricting requests per time period (1 refresh/hour)
- **Grounded Response**: AI answer citing specific data sources
- **Trust Level**: 1-5 scale rating data source reliability
- **Stale**: Data older than expected sync interval

---

**Document Version History**:
- v1.0 (Jun 2026): Initial PRD
- v2.0 (Jul 2026): Added dataset management features
- v2.1 (Aug 2026): Enhanced with search, refresh rate limiting, "What's New" transparency
- v2.2 (Aug 2026): Added Weather Map Forecast tab (`/weather`); diversified AI
  provider routing with Qwen (Model Studio) and Together AI ahead of DeepSeek;
  fixed dashboard load latency, ambient globe rendering reliability, and an
  AI-provider status display that was hardcoded regardless of configuration
