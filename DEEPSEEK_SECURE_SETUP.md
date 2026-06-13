# DeepSeek API Key Configuration — Secure Setup Guide

This guide provides secure, production-ready setup for DeepSeek v4 Flash API integration.

## Overview

- ✅ **API keys stored securely** in `.env.local` (never committed to Git)
- ✅ **Backend-only** API calls (no keys exposed to browser)
- ✅ **Environment-based** configuration (no hardcoded values)
- ✅ **Startup validation** (fails fast if key is missing)
- ✅ **Secure logging** (no secrets logged to console)

---

## Step 1: Create `.env.local` in Backend Directory

### Mac / Linux

```bash
cd backend

# Create or edit .env.local
cat > .env.local << 'EOF'
ENVIRONMENT=development
DEEPSEEK_API_KEY=sk-your_actual_deepseek_api_key_here
DEEPSEEK_MODEL=deepseek-v4-flash
DEEPSEEK_BASE_URL=https://api.deepseek.com/v1
EOF
```

**Replace `sk-your_actual_deepseek_api_key_here` with your actual DeepSeek API key.**

### Windows PowerShell

```powershell
cd backend

# Create .env.local with your API key
@"
ENVIRONMENT=development
DEEPSEEK_API_KEY=sk-your_actual_deepseek_api_key_here
DEEPSEEK_MODEL=deepseek-v4-flash
DEEPSEEK_BASE_URL=https://api.deepseek.com/v1
"@ | Out-File -FilePath .env.local -Encoding UTF8
```

**Replace `sk-your_actual_deepseek_api_key_here` with your actual DeepSeek API key.**

### Verify the File

```bash
cat .env.local
```

Expected output:
```
ENVIRONMENT=development
DEEPSEEK_API_KEY=sk-...
DEEPSEEK_MODEL=deepseek-v4-flash
DEEPSEEK_BASE_URL=https://api.deepseek.com/v1
```

---

## Step 2: Verify `.env.local` is in `.gitignore`

```bash
# From project root
cat .gitignore | grep env
```

Expected output:
```
.env
.env.local
.env*.local
```

If `.env.local` is NOT listed, add it:

```bash
echo ".env.local" >> .gitignore
```

---

## Step 3: Verify No Secrets Are Exposed

Run security scan from **project root**:

```bash
# ❌ Check for leaked API keys (should return nothing)
grep -r "sk-" . --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" --include="*.py" 2>/dev/null | grep -v node_modules | grep -v ".next" | grep -v "__pycache__"

# ❌ Check for hardcoded DEEPSEEK_API_KEY (should return nothing)
grep -r "DEEPSEEK_API_KEY.*=" . --include="*.ts" --include="*.tsx" --include="*.js" --include="*.py" 2>/dev/null | grep -v node_modules | grep -v ".next" | grep -v "__pycache__" | grep -v ".env.example"

# ❌ Check for apiKey references in frontend
grep -r "apiKey\|API_KEY" frontend/ --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v node_modules | grep -v ".next"
```

**All commands should return empty results.**

---

## Step 4: Restart the Application

### Backend

```bash
cd backend

# Kill any existing process
pkill -f "uvicorn\|python"

# Start fresh
python -m uvicorn app.main:app --reload --port 8000
```

### Frontend (new terminal)

```bash
cd frontend
npm run dev
```

Visit: **http://localhost:3000**

---

## Step 5: Verify DeepSeek is Working

### Check Backend Configuration

```bash
curl http://localhost:8000/api/ai-provider-info
```

Expected response:
```json
{
  "provider": "deepseek",
  "model": "deepseek-v4-flash",
  "provider_display": "DeepSeek",
  "model_display": "DeepSeek V4 Flash"
}
```

### Test AI Query

```bash
curl -X POST http://localhost:8000/api/ask-ai \
  -H "Content-Type: application/json" \
  -d '{
    "query": "What are the main flood hazards?",
    "lat": 14.5,
    "lng": 121.0,
    "location_name": "Manila",
    "persona": "citizen",
    "provider": "deepseek"
  }'
```

Expected response: AI-generated answer grounded in official data.

---

## Step 6: Production Deployment (Vercel)

### Set Environment Variables in Vercel Dashboard

1. Go to: **Vercel Dashboard → Project Settings → Environment Variables**
2. Add these variables for **Production**:
   - Key: `DEEPSEEK_API_KEY` → Value: `sk-your_deepseek_key`
   - Key: `DEEPSEEK_MODEL` → Value: `deepseek-v4-flash`
   - Key: `DEEPSEEK_BASE_URL` → Value: `https://api.deepseek.com/v1`

### ❌ Do NOT

- ❌ Store secrets in `vercel.json`
- ❌ Store secrets in `config.ts` or `config.py`
- ❌ Store secrets in source code
- ❌ Expose secrets via `NEXT_PUBLIC_*` variables
- ❌ Log secrets to console

---

## Security Checklist

- ✅ `.env.local` created with `DEEPSEEK_API_KEY`
- ✅ `.env.local` is in `.gitignore`
- ✅ No API keys in source code (`grep` scan passed)
- ✅ No API keys in frontend code
- ✅ Backend validation enabled (fails if key missing)
- ✅ Startup logs show "DeepSeek configured" (not the key)
- ✅ Vercel environment variables set (if deployed)
- ✅ No secrets in browser DevTools
- ✅ All AI calls occur server-side only
- ✅ Source-grounding happens before response is sent to frontend

---

## Troubleshooting

### "DeepSeek API key not configured"

**Problem:** Backend starts but shows error about missing API key.

**Solution:**
1. Check `.env.local` exists: `cat backend/.env.local`
2. Verify `DEEPSEEK_API_KEY=sk-...` is present
3. Restart backend: `pkill -f uvicorn && python -m uvicorn app.main:app --reload --port 8000`

### "Invalid API key" Error

**Problem:** DeepSeek API returns 401 Unauthorized.

**Solution:**
1. Verify API key is correct: `echo $DEEPSEEK_API_KEY`
2. Check key has not expired or been rotated
3. Go to DeepSeek dashboard and regenerate key if needed
4. Update `.env.local` with new key
5. Restart backend

### "Model not found: deepseek-v4-flash"

**Problem:** DeepSeek API returns 404 for the model.

**Solution:**
1. Verify model name is correct: `echo $DEEPSEEK_MODEL`
2. DeepSeek model might be `deepseek-chat` or `deepseek-reasoner`
3. Update `.env.local`: `DEEPSEEK_MODEL=deepseek-chat`
4. Restart backend

---

## Secure Logging

### ✅ What IS Safe to Log

```python
# Safe: only operation status
logger.info("DeepSeek request sent")
logger.info("AI response received")
logger.info("Source grounding completed")
```

### ❌ What MUST NEVER Be Logged

```python
# NEVER LOG THESE:
logger.info(f"API Key: {api_key}")  # ❌ LEAK
logger.info(f"Request: {request}")  # ❌ LEAK if contains auth
logger.info(f"Response: {response}")  # ❌ LEAK if contains secrets
print(os.environ)  # ❌ LEAK
```

---

## Reference

- [DeepSeek API Docs](https://platform.deepseek.com/api-docs)
- [Vercel Environment Variables](https://vercel.com/docs/environment-variables)
- [Python-dotenv](https://python-dotenv.readthedocs.io/)

---

## Support

If you encounter issues:
1. Check this guide's troubleshooting section
2. Verify API key at: https://platform.deepseek.com/api-keys
3. Check backend logs: `tail -f backend.log`
4. Ensure `.env.local` permissions are readable: `chmod 644 backend/.env.local`
