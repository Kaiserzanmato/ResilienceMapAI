# Ask AI / AI Agent — Disaster Intelligence Guardrails

**Updated:** June 13, 2026

This document defines the scope, source attribution rules, and safety guardrails for the Resilience Map AI's "Ask AI" feature. These guardrails ensure that all AI-generated responses are grounded in official disaster intelligence sources and scoped to disaster-related queries only.

---

## Overview

**Ask AI** (`/api/ask-ai`) is a guardrailed AI endpoint that:

1. **Classifies every user query** as in-scope (disaster/hazard/resilience) or out-of-scope (unrelated)
2. **Refuses out-of-scope queries** with a standard message instead of retrieving external data
3. **Sources responses only from approved disaster sources** — a curated registry of 73+ official and trusted sources
4. **Attributes every answer** with source name, URL, timestamp, hazard type, and confidence category
5. **Enforces rate limiting** with user-friendly messages explaining retry-after timing
6. **Never invents data** — if a source is unavailable, says so instead of hallucinating

---

## Scope Rules

### In Scope ✅

Ask AI can answer questions about:

- **Hazards & disasters:** earthquakes, volcanoes, tsunami, tropical cyclones, floods, droughts, wildfires, landslides, heat waves
- **Weather & climate:** rainfall, monsoon, heat index, weather forecasts, climate risk, precipitation
- **Geologic hazards:** earthquakes, seismic activity, faults, ground shaking, liquefaction, ashfall, lahar
- **Emergency response & resilience:** evacuations, shelters, preparedness, disaster response, recovery, risk reduction
- **Satellite-detected hazards:** active fires, flood extents, thermal anomalies
- **Humanitarian & disaster reports:** situation updates, damage estimates, relief operations
- **Location-based hazard assessment:** risk screening, exposure analysis, vulnerability mapping

**Query examples (in scope):**
- "Is there an active earthquake near Davao?"
- "What's the current tropical cyclone threat to the Philippines?"
- "How can we prepare for floods in this area?"
- "What wildfire activity is detected in Southeast Asia?"

### Out of Scope ❌

Ask AI refuses to answer questions about:

- Sports, entertainment, music, movies
- Food, cooking, restaurants
- Politics, elections, candidates
- Celebrity gossip
- **Any topic unrelated to disasters, hazards, resilience, or emergency management**

**Query examples (out of scope):**
- "Who won the basketball game?"
- "What's a good recipe for pasta?"
- "What movie should I watch tonight?"

When a query is out of scope, the system responds:

```
I can only answer questions related to Resilience Map AI, disaster intelligence, 
hazard monitoring, and resilience mapping.
```

---

## Source Attribution Requirement

Every Ask AI response must include:

1. **Source Name** — e.g., "PHIVOLCS Latest Earthquake Information"
2. **Source URL** — e.g., "https://earthquake.phivolcs.dost.gov.ph/"
3. **Timestamp** — When the data was retrieved or last updated
4. **Hazard Type** — e.g., "earthquake", "tropical cyclone", "flood"
5. **Location** — If available, the affected area or region
6. **Data Confidence Category** — One of:
   - **Official warning** — e.g., PHIVOLCS earthquake report, PAGASA tropical cyclone bulletin
   - **Official advisory** — e.g., volcano alert level, tsunami advisory
   - **Official observation** — e.g., reported rainfall, earthquake magnitude
   - **Model forecast** — e.g., weather forecast, flood model projection
   - **Satellite detection** — e.g., NASA FIRMS active fire, Copernicus flood extent
   - **Humanitarian report** — e.g., ReliefWeb situation update
   - **Historical record** — e.g., past earthquake, historical climate data
   - **Static reference** — e.g., hazard susceptibility map, geologic fault map

**Example response with attribution:**

```
According to PHIVOLCS Latest Earthquake Information 
(https://earthquake.phivolcs.dost.gov.ph/), 
a magnitude 5.2 earthquake was detected 42 km north of Manila at 14:30 UTC.

Source: PHIVOLCS
URL: https://earthquake.phivolcs.dost.gov.ph/
Timestamp: 2026-06-13 14:30 UTC
Hazard Type: Earthquake
Location: Luzon, Philippines
Confidence Category: Official Observation
```

---

## Approved Disaster Source Registry

The system uses a curated registry of **73 official and trusted sources**, organized by tier and region.

### Top Priority (Philippines)

For Philippine-related queries, prioritize these national official sources:

| Source ID | Source | Agency | Scope |
|-----------|--------|--------|-------|
| SRC-002 | PAGASA Weather Forecast | DOST-PAGASA | Weather, rainfall, monsoon, thunderstorm |
| SRC-003 | PAGASA Severe Weather Bulletin | DOST-PAGASA | Tropical cyclone, storm signals, rainfall warning |
| SRC-008 | PHIVOLCS Latest Earthquake Information | DOST-PHIVOLCS | Earthquakes, seismic activity |
| SRC-009 | PHIVOLCS Volcano Bulletins | DOST-PHIVOLCS | Volcanoes, eruptions, alert levels |
| SRC-010 | PHIVOLCS Tsunami Information | DOST-PHIVOLCS | Tsunami advisories and warnings |
| SRC-012 | HazardHunterPH | GeoRisk Philippines | Location-based multi-hazard assessment |
| SRC-018 | NDRRMC Official Portal | NDRRMC / OCD | Disaster response, situation reports |
| SRC-019 | Office of Civil Defense | OCD | Civil defense advisories, preparedness |
| SRC-015 | MGB Geohazard Maps | DENR-MGB | Landslide, flood susceptibility maps |

### Global/Regional Sources

For non-Philippines queries, use international sources:

| Source ID | Source | Agency | Scope | Hazards |
|-----------|--------|--------|-------|---------|
| SRC-020, SRC-021 | GDACS | Global DIS | Multi-hazard alerts | Earthquakes, tsunamis, cyclones, floods, volcanoes, droughts, wildfires |
| SRC-034, SRC-035 | NASA FIRMS | NASA | Global | Active fires, wildfire detection |
| SRC-038 | NASA EONET API | NASA | Global | Natural events (wildfire, storm, volcano, flood) |
| SRC-046 | Copernicus GloFAS | Copernicus EMS | Global | Flood forecasts |
| SRC-053, SRC-054 | USGS Earthquake | USGS | Global | Earthquakes, seismic activity |
| SRC-056 | NOAA Tsunami.gov | NOAA | Pacific, Caribbean | Tsunami advisories |
| SRC-024 | ReliefWeb | UN OCHA | Global | Humanitarian reports, disaster updates |

**Full registry:** See `backend/app/data/disaster_sources.py`

---

## Rate Limiting & User-Friendly Messages

Ask AI enforces rate limiting to ensure fair access and service stability.

### Rate Limits

- **Standard API endpoints:** 100 requests per 300 seconds (20 requests/min)
- **Ask AI endpoint:** 10 requests per 300 seconds (2 queries/min)

### When Rate Limited (HTTP 429)

The system returns a user-friendly message explaining:

1. **Why** they're being rate-limited (fair access, service stability)
2. **How long** to wait before trying again (exact seconds)
3. **What they can do** (wait and retry)

**Example response:**

```json
{
  "detail": "You've reached the Ask AI rate limit (10 queries per 300 seconds). Please wait 300 seconds before trying again. This limit helps ensure fair access for all users and maintains service stability.",
  "retry_after_seconds": 300,
  "limit": 10,
  "window_seconds": 300
}
```

**Frontend experience:**

- User sees the message: "You've reached the Ask AI rate limit. Please wait 300 seconds before trying again."
- The send button remains disabled during the rate limit window
- A countdown timer can show remaining wait time

### Rate Limit Headers

All 429 responses include the standard HTTP `Retry-After` header:

```
Retry-After: 300
```

---

## Query Scope Classification

The system uses regex patterns to classify queries as in or out of scope.

### In-Scope Patterns (🟢 Green)

```regex
\b(earthquake|seismic|shaking|fault|landslide|volcano|eruption|ashfall|lahar)\b
\b(tsunami|tidal wave|wave)\b
\b(cyclone|typhoon|hurricane|storm|tropical|wind|gale)\b
\b(flood|overflow|inundation|water level|river|rainfall|rain)\b
\b(drought|dryness|water scarcity)\b
\b(wildfire|forest fire|bushfire|thermal anomaly|hotspot)\b
\b(heat|temperature|heat index|heat wave)\b
\b(weather|meteorology|climate|precipitation|hail|lightning|thunderstorm)\b
\b(hazard|risk|danger|threat|warning|advisory|alert)\b
\b(disaster|calamity|emergency|crisis|catastrophe)\b
\b(resilience|preparedness|response|recovery|risk reduction|drr)\b
\b(satellite|remote sensing|earth observation|monitoring|detection)\b
\b(evacuation|shelter|aid|relief|humanitarian|response)\b
\b(exposure|vulnerability|adaptation|mitigation)\b
```

### Out-of-Scope Patterns (🔴 Red)

```regex
\b(sports|game|score|win|lose|match)\b
\b(music|song|artist|concert|album)\b
\b(movie|film|tv|series|watch|entertainment)\b
\b(restaurant|food|cook|recipe|dining)\b
\b(politics|election|vote|candidate|party)\b
\b(celebrity|gossip|famous|actor|actress)\b
```

---

## Philippines Priority Rule

For any query related to the Philippines, **always prioritize Philippine national official sources** (PAGASA, PHIVOLCS, NDRRMC, OCD, MGB, GeoRiskPH).

Use international sources (NASA, Copernicus, GDACS, USGS, NOAA, JMA) only as supporting or regional references.

**Example:**

User: "Is there an earthquake near Manila?"

**Correct priority:**
1. Check PHIVOLCS Latest Earthquake Information (primary)
2. Check USGS Earthquake GeoJSON as secondary validation
3. If neither has data, report unavailability

**Incorrect approach:**
- Showing USGS data without PHIVOLCS
- Prioritizing global sources over national sources for PH queries

---

## Safety & Accuracy Rules

### Do ✅

- Clearly distinguish between warnings, advisories, forecasts, satellite detections, and historical records
- Use calm, factual, public-safety-oriented language
- State when data is unavailable, outdated, or uncertain
- Recommend checking official agencies directly for critical information
- Include timestamps for all live or near-real-time data
- Acknowledge limitations of model forecasts vs. confirmed observations

### Don't ❌

- **Never claim confirmation** unless the official source explicitly confirms it
- **Never exaggerate** risk levels or use panic-inducing language
- **Never invent data** — if a source fails, say so instead of hallucinating
- **Never ignore timestamp freshness** — label old data as stale
- **Never guess** at casualty counts, damage estimates, or official response actions
- **Never use unvetted external sources** — only approved registry sources

---

## Implementation Details

### Backend

**Endpoint:** `POST /api/ask-ai`

**Request:**
```json
{
  "query": "Is there an active earthquake near Davao?",
  "persona": "citizen",
  "provider": null,
  "lat": 7.07,
  "lng": 125.59,
  "location_name": "Davao, Philippines"
}
```

**Response (in-scope):**
```json
{
  "status": "in_scope",
  "message": "Query processed with Resilience Map AI guardrails.",
  "sources": [
    {
      "source_id": "SRC-008",
      "source_name": "PHIVOLCS Latest Earthquake Information",
      "url": "https://earthquake.phivolcs.dost.gov.ph/",
      "agency": "DOST-PHIVOLCS",
      "scope": "Philippines",
      "tier": "official-national"
    }
  ],
  "answer": "According to the latest PHIVOLCS data, no significant earthquakes have been reported near Davao in the last 24 hours...",
  "confidence_category": "official_observation",
  "disclaimer": "This response is generated by an AI model..."
}
```

**Response (out-of-scope):**
```json
{
  "status": "out_of_scope",
  "message": "I can only answer questions related to Resilience Map AI, disaster intelligence, hazard monitoring, and resilience mapping.",
  "sources": [],
  "answer": null,
  "confidence_category": null,
  "disclaimer": null
}
```

### Frontend

**Component:** `AIAgentPanel.tsx`

**Error handling:**
- Catches HTTP 429 (rate limit) responses
- Displays user-friendly rate limit message with retry timing
- Shows `out_of_scope` status without attempting API calls
- Renders source attribution cards below each response
- Shows disclaimer/warning with every answer

---

## Testing & Validation

### Unit Tests

- `test_ask_ai.py` — Scope classification (in/out patterns)
- `test_sources.py` — Source registry validation
- Rate limiting — 429 response with correct headers

### Integration Tests

- Scope guard blocks out-of-scope queries
- In-scope queries reach approved sources only
- Attribution includes all required fields
- Rate limit messages are user-friendly

### Manual Testing

1. **In-scope query:** "Is there an earthquake near Manila?"
   - Should classify as in_scope
   - Should return sources from PHIVOLCS
   - Should include timestamp and confidence category

2. **Out-of-scope query:** "Who won the basketball game?"
   - Should classify as out_of_scope
   - Should return refusal message
   - Should NOT attempt external API calls

3. **Rate limit:** Send 11 queries within 300 seconds
   - 11th query should return 429
   - Message should explain 300-second wait
   - `Retry-After` header should be present

---

## Deployment & Configuration

**Environment variables:**

```bash
# Rate limiting (in security.py)
RATE_LIMIT_REQUESTS=100                 # General endpoints, per window
AI_RATE_LIMIT_REQUESTS=10               # Ask AI, per window
RATE_LIMIT_WINDOW_SECONDS=300           # 5 minutes

# AI providers (optional; local fallback always available)
QWEN_API_KEY=                           # Optional
DEEPSEEK_API_KEY=                       # Optional
OPENAI_API_KEY=                         # Optional
GEMINI_API_KEY=                         # Optional
```

**Monitoring:**

```python
# Audit logs include Ask AI queries:
audit_logger.info("RATE_LIMITED ip=%s path=%s", ip, "/api/ask-ai")
```

---

## Future Enhancements

- **Live source fetching:** Implement adapters to pull live data from PHIVOLCS, PAGASA, NASA FIRMS, GDACS
- **Data caching:** Cache source responses to reduce API load
- **Source reliability scoring:** Weight sources by availability and accuracy
- **Multi-language support:** Translate guardrails and refusal messages
- **Redis rate limiting:** For multi-instance deployments

---

## Questions & Support

For questions about the Ask AI guardrails, check:

1. This document (ASK_AI_GUARDRAILS.md)
2. Source registry: `backend/app/data/disaster_sources.py`
3. Implementation: `backend/app/services/ask_ai.py`
4. Frontend: `frontend/components/ai/AIAgentPanel.tsx`
5. Tests: `backend/tests/test_ai_guardrails.py`
