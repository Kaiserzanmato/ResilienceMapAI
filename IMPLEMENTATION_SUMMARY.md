# Ask AI / AI Agent Guardrails — Implementation Summary

**Date:** June 13, 2026  
**Status:** ✅ Complete and tested

## Overview

Implemented a comprehensive guardrailed Ask AI / AI Agent system for the Resilience Map platform with scope checking, source attribution, user-friendly rate limiting, and approved disaster source registry.

---

## What Was Built

### 1. **Disaster Source Registry** (`backend/app/data/disaster_sources.py`)
- **73 official and trusted sources** for disaster intelligence, hazard monitoring, weather/climate risk, and resilience planning
- Organized by tier: official-national, official-international, official-space-agency, official-un, trusted-development, trusted-academic
- **Philippine priority sources:** PAGASA, PHIVOLCS, NDRRMC/OCD, MGB, GeoRiskPH prioritized for Philippines queries
- Helper functions: `get_source()`, `list_sources()`, `get_sources_for_hazard()`

### 2. **Ask AI Service** (`backend/app/services/ask_ai.py`)
- **Scope classification:** Regex-based in/out-of-scope detection with 14 in-scope patterns and 6 out-of-scope patterns
- **Guardrailed queries:** Only in-scope queries retrieve data; out-of-scope queries receive refusal message
- **Source attribution:** Every response includes source name, URL, agency, scope, tier
- **Hazard type extraction:** Automatically identifies which hazards are mentioned in the query
- **Async endpoint:** `ask_ai_guardrailed()` function handles full guardrail flow

### 3. **API Endpoint** (`POST /api/ask-ai` in `backend/app/main.py`)
- Request schema: `query`, `persona`, `provider`, `lat`, `lng`, `location_name`
- Response fields: `status`, `message`, `sources[]`, `answer`, `confidence_category`, `disclaimer`
- Integrated with existing rate limiting and audit logging

### 4. **Rate Limiting with User-Friendly Messages** (`backend/app/security.py`)
- **Ask AI rate limit:** 10 queries per 300 seconds (2 queries/min)
- **User-friendly 429 response:**
  ```json
  {
    "detail": "You've reached the Ask AI rate limit (10 queries per 300 seconds). Please wait 300 seconds before trying again. This limit helps ensure fair access for all users and maintains service stability.",
    "retry_after_seconds": 300,
    "limit": 10,
    "window_seconds": 300
  }
  ```
- Standard `Retry-After` HTTP header included

### 5. **Frontend Integration** (`frontend/components/ai/AIAgentPanel.tsx`)
- Updated `ask()` function to use `/api/ask-ai` endpoint
- Handles three response types: in-scope, out-of-scope, rate-limited
- Displays source attribution with proper UI rendering
- Shows user-friendly rate limit messages with retry timing
- TypeScript-safe error handling with `APIError` class

### 6. **API Client Updates** (`frontend/lib/api.ts`)
- Added `APIError` class to capture HTTP status codes and response bodies
- Added `api.post<T>()` method for generic POST requests
- Updated `request()` function to throw `APIError` with status codes for proper error handling

### 7. **Comprehensive Documentation** (`ASK_AI_GUARDRAILS.md`)
- Complete guide covering scope rules, source attribution, rate limiting, classification patterns
- Philippines priority rules with examples
- Safety & accuracy guardrails
- Implementation details for backend and frontend
- Testing checklist with sample queries

### 8. **Test Suite** (`backend/tests/test_ai_guardrails.py`)
- **11 new tests** for Ask AI guardrails (total: 28 tests, all passing)
- Scope classification tests (in-scope: earthquake, cyclone, flood, resilience; out-of-scope: sports, food, entertainment, politics)
- Guardrailed function tests: out-of-scope refusal, in-scope response, source attribution
- Async test support with pytest-asyncio

---

## Files Modified or Created

| File | Type | Changes |
|------|------|---------|
| `backend/app/data/disaster_sources.py` | ✨ Created | 73-source registry with priority sorting |
| `backend/app/services/ask_ai.py` | ✨ Created | Scope classification, guardrail enforcement |
| `backend/app/main.py` | ✏️ Modified | Added `/api/ask-ai` endpoint |
| `backend/app/schemas.py` | ✏️ Modified | Added `AskAIRequest` schema |
| `backend/app/security.py` | ✏️ Modified | User-friendly rate limit messages for Ask AI |
| `frontend/components/ai/AIAgentPanel.tsx` | ✏️ Modified | Updated `ask()` function with guardrail handling |
| `frontend/lib/api.ts` | ✏️ Modified | Added `APIError` class and `api.post()` method |
| `backend/tests/test_ai_guardrails.py` | ✏️ Modified | Added 11 new guardrail tests |
| `ASK_AI_GUARDRAILS.md` | ✨ Created | 200+ line comprehensive documentation |
| `IMPLEMENTATION_SUMMARY.md` | ✨ Created | This file |

---

## Key Features

### ✅ Scope Checking
- Queries automatically classified as in-scope or out-of-scope
- Out-of-scope queries refused with standard message without API calls
- In-scope patterns: disasters, hazards, weather, climate, resilience, preparedness, response, recovery

### ✅ Source Attribution
- Every response cites: source name, URL, agency, scope, tier
- Confidence categories: official warning, advisory, observation, forecast, satellite detection, humanitarian report, historical record
- Timestamps included for live/near-real-time data

### ✅ User-Friendly Rate Limiting
- Clear message explaining why they're rate-limited
- Exact seconds to wait: "Please wait 300 seconds before trying again"
- Retry-After header for API clients
- Distinction from errors: rate limit shown as separate message type

### ✅ Philippines Priority
- National official sources prioritized for PH queries
- PAGASA → PHIVOLCS → NDRRMC/OCD → MGB first
- International sources as supporting references

### ✅ Safety Guardrails
- Never invents data — says "unavailable" if source fails
- Clear distinction: warnings vs. forecasts vs. detections
- No panic-inducing language
- Input sanitization and output redaction (existing)

---

## Testing

**Backend tests:** 28 passing (including 11 new)
```bash
cd backend && .venv/bin/python -m pytest tests/ -q
# ............................  [100%]
# 28 passed in 0.34s
```

**Frontend TypeScript:** Clean (no errors)
```bash
cd frontend && npx tsc --noEmit
# (no output = no errors)
```

**Sample test queries:**
- In-scope: "Is there an active earthquake near Davao?" → `in_scope` with PHIVOLCS sources
- Out-of-scope: "Who won the basketball game?" → `out_of_scope` with refusal message
- Rate limit (11th query in 300s): → 429 with friendly message

---

## Deployment Notes

### Environment Variables (Backend)

```bash
# Rate limiting (already configured)
RATE_LIMIT_REQUESTS=100
AI_RATE_LIMIT_REQUESTS=10
RATE_LIMIT_WINDOW_SECONDS=300

# AI providers (optional; local fallback always available)
QWEN_API_KEY=          # Optional
DEEPSEEK_API_KEY=      # Optional
OPENAI_API_KEY=        # Optional
GEMINI_API_KEY=        # Optional
```

### API Response Format

**In-Scope:**
```json
{
  "status": "in_scope",
  "message": "Query processed with Resilience Map AI guardrails.",
  "sources": [...],
  "answer": "According to PHIVOLCS...",
  "confidence_category": "official_observation",
  "disclaimer": "..."
}
```

**Out-of-Scope:**
```json
{
  "status": "out_of_scope",
  "message": "I can only answer questions related to Resilience Map AI...",
  "sources": [],
  "answer": null,
  "confidence_category": null,
  "disclaimer": null
}
```

**Rate Limited (429):**
```json
{
  "detail": "You've reached the Ask AI rate limit...",
  "retry_after_seconds": 300,
  "limit": 10,
  "window_seconds": 300
}
```

---

## Next Steps (Optional Enhancements)

1. **Live source fetching:** Implement adapters to pull real-time data from PHIVOLCS, PAGASA, NASA FIRMS, GDACS
2. **Data caching:** Cache responses to reduce API load (Redis)
3. **Source scoring:** Weight sources by availability and accuracy
4. **Multi-language:** Translate guardrails and messages
5. **Analytics:** Track most common queries and source usage

---

## Documentation

**Main documentation:** `ASK_AI_GUARDRAILS.md` (200+ lines)
- Scope rules (in/out)
- Source registry overview
- Rate limiting behavior
- Python regex patterns
- Implementation details
- Testing checklist

**Quick reference:**
- Source registry: `backend/app/data/disaster_sources.py`
- Service: `backend/app/services/ask_ai.py`
- API: `POST /api/ask-ai`
- Frontend: `components/ai/AIAgentPanel.tsx`
- Tests: `backend/tests/test_ai_guardrails.py`

---

## Summary

The Ask AI / AI Agent system is **fully implemented, tested, and documented**. All 28 backend tests pass, TypeScript is clean, and the feature is ready for deployment. Users will see:

- Clear scope boundaries (disasters/hazards only)
- Proper source attribution on every answer
- User-friendly rate limit explanations
- Out-of-scope refusal messages instead of hallucinations
- Full integration with existing rate limiting and audit logging

🎉 **Ready for production!**
