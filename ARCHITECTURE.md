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
│  │  ├─ Dashboard (/dashboard)       - Executive KPIs               │ │
│  │  ├─ AI Workspace (/agents)       - Persona-based assistant     │ │
│  │  ├─ Reports (/reports)           - PDF/CSV exports             │ │
│  │  ├─ Resources (/resources)       - Documentation & datasets    │ │
│  │  ├─ Datasets (/admin/datasets)   - Data source management      │ │
│  │  └─ Settings (/settings)         - User preferences            │ │
│  │                                                                    │ │
│  │  Features:                                                         │ │
│  │  ├─ MapLibre GL JS rendering                                     │ │
│  │  ├─ Real-time hazard layer updates                               │ │
│  │  ├─ Ambient globe with d3-geo                                    │ │
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
│   │   ├── dashboard/             - Executive dashboards
│   │   ├── agents/                - AI workspace
│   │   ├── reports/               - Report generation
│   │   ├── resources/             - Documentation & datasets (enhanced)
│   │   ├── admin/datasets/        - Data management (enhanced)
│   │   ├── settings/              - User preferences
│   │   └── layout.tsx             - Shared layout
│   ├── layout.tsx                 - Root layout
│   └── page.tsx                   - Landing page
├── components/
│   ├── globe/                     - Ambient globe component
│   ├── map/                       - MapLibre wrapper & layers
│   ├── charts/                    - Recharts visualizations
│   ├── ui/                        - Design system (GlassCard, etc.)
│   └── ...                        - Other reusable components
├── lib/
│   ├── api.ts                     - API client & endpoints
│   ├── utils.ts                   - Utility functions
│   ├── types.ts                   - TypeScript type definitions
│   └── feature-flags.ts           - Feature toggles
└── public/                        - Static assets

Key Files (New/Enhanced):
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

---

## Backend Architecture

### Directory Structure
```
backend/
├── app/
│   ├── main.py                    - FastAPI app setup
│   ├── security.py                - Auth & rate limiting
│   ├── middleware.py              - CORS, logging, validation
│   ├── scoring/                   - Risk calculation engine
│   ├── data_sources/              - Data connectors
│   │   ├── gdacs.py               - GDACS connector
│   │   ├── nasa_eonet.py          - NASA EONET connector
│   │   ├── usgs.py                - USGS earthquake connector
│   │   ├── reliefweb.py           - ReliefWeb connector
│   │   └── registry/
│   │       └── sources_registry.py - Master source list (45 sources)
│   ├── ai_providers/              - LLM abstraction
│   │   ├── qwen.py
│   │   ├── deepseek.py
│   │   ├── openai.py
│   │   ├── gemini.py
│   │   └── fallback.py
│   ├── models/                    - Pydantic models
│   │   ├── location.py
│   │   ├── risk.py
│   │   └── report.py
│   ├── repositories/              - Data access patterns
│   │   ├── sync_health.py         - Sync status persistence
│   │   ├── audit_log.py           - Event logging
│   │   ├── datasets.py            - Dataset metadata
│   │   └── reports.py             - Report storage
│   └── routes/                    - API endpoints
│       ├── risk.py                - Risk assessment endpoints
│       ├── ai.py                  - AI/agent endpoints
│       ├── datasets.py            - Dataset management
│       ├── sync.py                - Data sync endpoints
│       └── reports.py             - Report endpoints
├── alembic/                       - Database migrations
├── tests/                         - Test suite
├── .env.example                   - Environment template
├── requirements.txt               - Python dependencies
└── runtime.txt                    - Python version (3.11)
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
  Qwen → DeepSeek → OpenAI → Gemini → Local fallback
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

---

## Environment Variables

### Frontend (.env.local)
```env
NEXT_PUBLIC_API_URL=https://resiliencemap-api.onrender.com  # Backend URL
NEXT_PUBLIC_MAP_STYLE=https://...                           # MapLibre style
```

### Backend (.env)
```env
# Required for production
DATABASE_URL=postgresql://...                               # PostgreSQL (Neon)
CRON_SECRET=...                                             # Vercel cron auth
ADMIN_SHARED_SECRET=...                                     # Admin operations

# Optional: AI providers (fallback to local if absent)
DEEPSEEK_API_KEY=...
OPENAI_API_KEY=...
GEMINI_API_KEY=...
QWEN_API_KEY=...

# Optional: Data source APIs
GDACS_API_KEY=...
RELIEFWEB_API_KEY=...
```

---

## Deployment Architecture

### Frontend (Vercel)
- Git-connected to `main` branch
- Auto-deploy on push (unreliable; use `vercel deploy --prod` for production)
- Environment variables: NEXT_PUBLIC_API_URL
- **Critical**: Must point to the backend URL; if empty, all API calls 404

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
- Lazy-load map (MapLibre GL) only when `/map` is visited
- Code-split AI features (`/agents`, `/api/ai/*`)
- Image optimization (Next.js Image component)
- Ambient globe hidden on small viewports
- Respects `prefers-reduced-motion`

### Backend
- Endpoint-specific rate limiting (tighter for AI)
- Cached source registry (regenerate after `sources_registry.py` edits)
- Prompt injection detection (flagged input treated as data)
- Database connection pooling (if using Postgres)

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

