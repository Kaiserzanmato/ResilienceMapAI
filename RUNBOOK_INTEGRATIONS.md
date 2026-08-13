# Current Event Runbook

## Enablement

1. Set `ENABLE_REALTIME_EVENTS=true` on the backend only after provider and security validation.
2. Set `NEXT_PUBLIC_ENABLE_REALTIME_EVENTS=true` only in the matching frontend environment.
3. Use `POST /api/data-sync` as a correctly authorized administrator or the cron endpoint with `CRON_SECRET` to refresh the shared cache.
4. Check `GET /api/events` for `providers`, `refreshed_at`, pagination, provenance, and source tier.

## Failure handling

Provider failures are isolated. `GET /api/events` continues returning cached events and marks the failing provider `unavailable`; it never turns missing data into a low-risk result. Disable the backend flag to stop all live-event retrieval without affecting map risk zones, assessments, weather, reports, or AI workspace.

## Security controls

All provider URLs are fixed in code. Redirects are disabled, timeouts are bounded, responses are limited to `EVENTS_MAX_RESPONSE_BYTES`, and normalized records are Pydantic validated. Firecrawl accepts only HTTPS/HTTP URLs, rejects literal internal IPs, and in production restricts hosts to `FIRECRAWL_ALLOWED_HOSTS`.
