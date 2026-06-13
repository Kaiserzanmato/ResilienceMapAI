# DeepSeek v4 Flash Integration Setup

This guide walks through setting up DeepSeek v4 Flash as the primary AI provider for Resilience Map AI.

## Prerequisites

- Node.js 18+
- DeepSeek API account at https://platform.deepseek.com
- Valid DeepSeek API key

## Backend Setup (FastAPI)

### 1. Install/Update Dependencies

No additional Python packages needed beyond existing `requirements.txt`. The backend uses standard HTTP to call DeepSeek's OpenAI-compatible API.

### 2. Configure Environment Variable

Add your DeepSeek API key to your `.env` file (or set as environment variable):

```bash
# In the backend/.env or system environment:
DEEPSEEK_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxx
```

**Important:** Never commit `.env` to version control. Add to `.gitignore`:

```bash
echo ".env" >> backend/.gitignore
```

### 3. Backend Configuration

The backend automatically detects the `DEEPSEEK_API_KEY` environment variable. Update `backend/app/config.py` to include:

```python
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # ... existing settings ...
    deepseek_api_key: str = ""  # Will be read from DEEPSEEK_API_KEY env var
    deepseek_base_url: str = "https://api.deepseek.com/v1"
    deepseek_model: str = "deepseek-chat"  # or "deepseek-reasoner" for reasoning tasks
```

### 4. Verify Configuration

Run the backend with:

```bash
cd backend
.venv/bin/python -m pytest tests/ -v  # Run tests to verify config
.venv/bin/uvicorn app.main:app --reload --port 8000
```

Check logs for "DeepSeek initialized" message.

## Frontend Setup (Next.js)

### 1. Install OpenAI SDK (if not already installed)

```bash
cd frontend
npm install openai
```

### 2. Configure Frontend Environment

Create or update `frontend/.env.local`:

```bash
# API endpoint (points to backend)
NEXT_PUBLIC_API_URL=http://localhost:8000  # local dev
# or
NEXT_PUBLIC_API_URL=https://resiliencemap-api.onrender.com  # production

# DeepSeek is called server-side only; no frontend API key needed
```

**Important:** Do NOT add `DEEPSEEK_API_KEY` to frontend `.env.local`. All AI calls must be server-side.

### 3. Verify Frontend Setup

```bash
npm run dev
# Open http://localhost:3000/map
# Test "Ask AI" button - it will reach the backend
```

## Production Deployment

### Render (Backend)

Add environment variable in Render dashboard:

```
DEEPSEEK_API_KEY = sk-xxxxxxxxxxxxxxxxxxxxx
DEEPSEEK_MODEL = deepseek-chat
DEEPSEEK_BASE_URL = https://api.deepseek.com/v1
```

### Vercel (Frontend)

Add environment variable in Vercel dashboard:

```
NEXT_PUBLIC_API_URL = https://resiliencemap-api.onrender.com
```

**Do NOT add DEEPSEEK_API_KEY to Vercel.**

## Testing DeepSeek Integration

### Local Testing

```bash
# Test backend Ask AI endpoint with curl:
curl -X POST http://localhost:8000/api/ask-ai \
  -H "Content-Type: application/json" \
  -d '{
    "query": "What is the current earthquake risk near Manila?",
    "persona": "citizen",
    "location_name": "Manila, Philippines"
  }'
```

Expected response:
```json
{
  "status": "in_scope",
  "message": "Query processed with Resilience Map AI guardrails.",
  "sources": [...],
  "answer": "Based on PHIVOLCS Latest Earthquake Information...",
  "confidence_category": "official_observation",
  "disclaimer": "..."
}
```

### Test with Different Models

To test reasoning (slower but more accurate):

```python
# In app/config.py
DEEPSEEK_MODEL = "deepseek-reasoner"  # Uses extended thinking
```

Note: Reasoner model is slower (10-30s) but provides detailed chain-of-thought.

## Fallback & Failover

If DeepSeek is unavailable, the system automatically falls back to the local deterministic insight generator:

```python
# app/services/ai_router.py
# If DEEPSEEK_API_KEY is empty or API fails,
# uses local_insight() function with no external API call
```

## Model Availability

### Supported DeepSeek Models

| Model | Use Case | Speed | Cost |
|-------|----------|-------|------|
| `deepseek-chat` | General AI queries, Ask AI | Fast (2-5s) | Low |
| `deepseek-reasoner` | Complex analysis, insights | Slow (10-30s) | Higher |
| `deepseek-coder` | Code-related queries | Fast | Low |

### Configuration

Current production setting:

```python
DEEPSEEK_MODEL = "deepseek-chat"  # Fast, suitable for Ask AI
```

To use reasoner for "Generate Insights":

```python
DEEPSEEK_INSIGHT_MODEL = "deepseek-reasoner"
```

## Troubleshooting

### "Invalid API Key" Error

- Verify key is correct: `echo $DEEPSEEK_API_KEY`
- Check key format starts with `sk-`
- Ensure key has sufficient API quota
- Visit https://platform.deepseek.com/account/api_keys

### "Rate Limit Exceeded" Error

DeepSeek has rate limits. Check:
- Rate limit headers in response: `x-ratelimit-remaining`
- Wait before retrying
- Consider increasing sync intervals in `app/config.py`

### "Model Not Found" Error

The model ID may have changed. Check available models:

```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
  https://api.deepseek.com/v1/models
```

Update `DEEPSEEK_MODEL` in config if needed.

### DeepSeek API Down

The system gracefully falls back to local deterministic insights. No user-facing errors, but responses will be less detailed.

## Security Checklist

- [ ] `DEEPSEEK_API_KEY` is in `.env` (not in Git)
- [ ] `DEEPSEEK_API_KEY` is NOT in frontend `.env.local`
- [ ] Backend calls DeepSeek via secure HTTPS
- [ ] API key is never logged or exposed in error messages
- [ ] `.env` is in `.gitignore`
- [ ] Production keys are set via deployment platform, not in code

## Next Steps

1. Get DeepSeek API key from https://platform.deepseek.com
2. Set `DEEPSEEK_API_KEY` environment variable
3. Restart backend: `npm run dev` (frontend) + `uvicorn app.main:app` (backend)
4. Test "Ask AI" button on map page
5. For "Generate Insights" feature, see `GENERATE_INSIGHTS.md`

## Support

- DeepSeek API docs: https://api-docs.deepseek.com/
- Issues: Check backend logs (`uvicorn` output) for API errors
- Local fallback: Always works even if DeepSeek is unavailable
