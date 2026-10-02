# ResilienceMap AI - Deployment Guide

**Version**: 2.0  
**Last Updated**: 2026-10-02  
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
NEXT_PUBLIC_ENABLE_FLOOD_CAPTURE=true   (optional; with the backend ENABLE_FLOOD_CAPTURE)
```
⚠️ If `NEXT_PUBLIC_API_URL` is missing the app falls back to localhost and every API call fails.

**Backend** (Render):
```
ENVIRONMENT=production
DATABASE_URL=<Neon connection string>  (required in production; secret)
CRON_SECRET=<random string>            (required for the scheduled sync; secret; same as the GitHub repo secret)
ADMIN_SHARED_SECRET=<random string>    (secret)
CORS_ORIGINS=<apex>,<www>,<vercel domain>   (see DEPLOYMENT.md)
RELIEFWEB_APPNAME=<approved appname>   (enables the ReliefWeb source)
```
Never put real values in this repo. The full list, with secret vs config, is in
[docs/ENVIRONMENT.md](./docs/ENVIRONMENT.md).

---

## Full Deployment Documentation

See dedicated deployment guide: [DEPLOYMENT.md](./DEPLOYMENT.md)

Covers:
- Step-by-step Vercel and Render setup
- `CORS_ORIGINS` and `CLIENT_IP_HEADER`
- Neon Postgres + PostGIS and Alembic (head `0008`)
- The GitHub Actions 6-hour source sync (five sources, including ReliefWeb) and the flood-capture drain

Day-two procedures (manual sync, safe production migrations, rollbacks, known limits) are in
[docs/OPERATIONS.md](./docs/OPERATIONS.md); every environment variable is in
[docs/ENVIRONMENT.md](./docs/ENVIRONMENT.md); flood capture is in
[docs/FLOOD_CAPTURE.md](./docs/FLOOD_CAPTURE.md).

