# ResilienceMap AI - Deployment Guide

**Version**: 2.0  
**Last Updated**: 2026-08-01  
**Status**: Production-Ready

---

## Quick Start Deployment

### Frontend (Vercel)
```bash
# Already connected to main branch
# Auto-deploys on git push

# Verify
vercel ls                          # Check deployments
vercel deploy --prod               # Manual deploy if needed
```

### Backend (Render)
```bash
# Already connected to main branch
# Auto-deploys on git push

# Verify
curl https://resiliencemap-api.onrender.com/api/sync-health
```

### Critical Environment Variables

**Frontend** (Vercel):
```
NEXT_PUBLIC_API_URL=https://resiliencemap-api.onrender.com
```
⚠️ If missing: API calls 404 silently, app breaks

**Backend** (Render):
```
DATABASE_URL=postgresql://...         (optional)
CRON_SECRET=<32-char-random-string>  (required)
ADMIN_SHARED_SECRET=<32-char-random> (required)
```

---

## Full Deployment Documentation

See dedicated deployment guide: [DEPLOYMENT.md](./DEPLOYMENT.md)

Covers:
- Step-by-step Vercel setup
- Step-by-step Render setup
- Environment variable configuration
- Database setup (optional Neon)
- Cron scheduling
- Monitoring & logging
- Troubleshooting guide
- Security checklist

