"""Application configuration. All secrets come from environment variables —
no API keys are ever shipped to the frontend."""
import logging
import os
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv
from pydantic_settings import BaseSettings

# Load environment variables from .env.local file if it exists
env_file = Path(__file__).parent.parent / ".env.local"
if env_file.exists():
    load_dotenv(env_file)


class Settings(BaseSettings):
    app_name: str = "ResilienceMap AI"
    version: str = "0.1.0"
    environment: str = os.getenv("ENVIRONMENT", "development")

    # CORS — restrict to the frontend origin(s)
    cors_origins: str = os.getenv(
        "CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000"
    )

    # AI provider keys (all optional — local deterministic fallback is used
    # when no key is configured, so the app works out of the box)
    qwen_api_key: str = os.getenv("QWEN_API_KEY", "")
    qwen_base_url: str = os.getenv(
        "QWEN_BASE_URL", "https://dashscope-intl.aliyuncs.com/compatible-mode/v1"
    )
    qwen_model: str = os.getenv("QWEN_MODEL", "qwen-plus")
    # Vision-capable Qwen model for the multimodal spatial-vision endpoint
    # (map screenshot + risk context in, grounded analysis out) — separate
    # from qwen_model above, which is text-only.
    qwen_vision_model: str = os.getenv("QWEN_VISION_MODEL", "qwen3-vl-flash")

    # Firecrawl: scrapes unstructured hazard advisories (PAGASA/PHIVOLCS/JMA
    # bulletins etc.) into hazard_events. Optional — the scraper worker
    # no-ops when unset, same pattern as the AI provider keys above.
    firecrawl_api_key: str = os.getenv("FIRECRAWL_API_KEY", "")
    firecrawl_allowed_hosts: str = os.getenv(
        "FIRECRAWL_ALLOWED_HOSTS",
        "pagasa.dost.gov.ph,phivolcs.dost.gov.ph,ndrrmc.gov.ph,jma.go.jp",
    )

    deepseek_api_key: str = os.getenv("DEEPSEEK_API_KEY", "")
    deepseek_base_url: str = os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com/v1")
    deepseek_model: str = os.getenv("DEEPSEEK_MODEL", "deepseek-chat")

    # Together AI: hosts open-weight models (Qwen, Llama, etc.) behind an
    # OpenAI-compatible API, with a managed fine-tuning API for the same
    # checkpoints — no self-hosted inference server required. Default model
    # is a well-established Together-hosted Qwen2.5 checkpoint (Apache 2.0,
    # fine-tunable); verify the exact model slug in the Together dashboard
    # before relying on a newer one (their catalog changes over time).
    together_api_key: str = os.getenv("TOGETHER_API_KEY", "")
    together_base_url: str = os.getenv("TOGETHER_BASE_URL", "https://api.together.xyz/v1")
    together_model: str = os.getenv("TOGETHER_MODEL", "Qwen/Qwen2.5-72B-Instruct-Turbo")

    mimo_api_key: str = os.getenv("MIMO_API_KEY", "")
    mimo_base_url: str = os.getenv("MIMO_BASE_URL", "https://api.xiaomimimo.com/v1")
    mimo_model: str = os.getenv("MIMO_MODEL", "mimo-7b-rl")

    openai_api_key: str = os.getenv("OPENAI_API_KEY", "")
    openai_base_url: str = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1")
    openai_model: str = os.getenv("OPENAI_MODEL", "gpt-4o-mini")

    gemini_api_key: str = os.getenv("GEMINI_API_KEY", "")
    gemini_model: str = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")

    # Rate limiting (requests per window, per client IP) — short-window
    # burst/abuse protection, enforced by RateLimitMiddleware.
    rate_limit_requests: int = int(os.getenv("RATE_LIMIT_REQUESTS", "120"))
    rate_limit_window_seconds: int = int(os.getenv("RATE_LIMIT_WINDOW", "60"))
    ai_rate_limit_requests: int = int(os.getenv("AI_RATE_LIMIT_REQUESTS", "20"))

    # Long-window usage quotas (per client IP) — separate from the burst
    # limiter above. "insights" is a tight sliding-window cap (each hit is
    # one expensive full AI generation from a single button click);
    # "chat" is a broader daily cap (resets at UTC midnight) shared by the
    # AI Agent panel and AI Workspace chat, since messages are lighter and
    # more frequent by nature. See app/services/usage_quota.py.
    insights_quota_limit: int = int(os.getenv("INSIGHTS_QUOTA_LIMIT", "3"))
    insights_quota_window_seconds: int = int(os.getenv("INSIGHTS_QUOTA_WINDOW", str(5 * 3600)))
    chat_quota_limit: int = int(os.getenv("CHAT_QUOTA_LIMIT", "20"))

    # Database (RBAC/auth-ready; the MVP runs on curated sample datasets)
    database_url: str = os.getenv("DATABASE_URL", "")
    redis_url: str = os.getenv("REDIS_URL", "")
    # Production keeps sync health, the audit log and synced events in Postgres.
    # Set ALLOW_EPHEMERAL_STATE=true only to knowingly run production without it.
    allow_ephemeral_state: bool = os.getenv("ALLOW_EPHEMERAL_STATE", "false").lower() == "true"

    # NASA FIRMS (fire hotspots). Without a MAP_KEY the source is skipped, never
    # recorded as a successful empty sync. "world" or a "west,south,east,north" bbox.
    nasa_firms_map_key: str = os.getenv("NASA_FIRMS_MAP_KEY", "")
    nasa_firms_area: str = os.getenv("NASA_FIRMS_AREA", "world")

    # Observed/distance-based scores for the risk panel. Wildfire reads FIRMS detections
    # stored by the sync (needs migration 0008); Volcanic scores distance to Philippine
    # volcanoes from a data file that is NOT in the repo (see docs/WILDFIRE_VOLCANIC.md): the
    # Smithsonian GVP terms do not allow redistribution, so it is off until a PHIVOLCS-sourced
    # file with usable terms is supplied via VOLCANO_DATA_FILE.
    enable_wildfire_scoring: bool = os.getenv("ENABLE_WILDFIRE_SCORING", "true").lower() == "true"
    enable_volcanic_scoring: bool = os.getenv("ENABLE_VOLCANIC_SCORING", "false").lower() == "true"
    volcano_data_file: str = os.getenv("VOLCANO_DATA_FILE", "")
    # Flood auto-capture (user flags + Sentinel-1/2 water extents). Off until the
    # feature is switched on; every /api/flood route 404s while it is off.
    enable_flood_capture: bool = os.getenv("ENABLE_FLOOD_CAPTURE", "false").lower() == "true"
    flood_flags_per_hour: int = int(os.getenv("FLOOD_FLAGS_PER_HOUR", "3"))
    # Side of the square capture box in km. Clamped in app/flood/processing.py:
    # areas over 100 km2 (a side above 10 km) are refused.
    flood_aoi_km: float = float(os.getenv("FLOOD_AOI_KM", "5"))
    flood_scene_window_days: int = int(os.getenv("FLOOD_SCENE_WINDOW_DAYS", "12"))
    # JRC Global Surface Water occurrence (%) at or above which a pixel counts as
    # permanent water and is subtracted from a capture. Outside 1..100: 75.
    flood_permanent_water_threshold: float = float(os.getenv("FLOOD_PERMANENT_WATER_THRESHOLD", "75"))
    flood_max_attempts: int = int(os.getenv("FLOOD_MAX_ATTEMPTS", "3"))
    flood_lease_seconds: int = int(os.getenv("FLOOD_LEASE_SECONDS", "300"))
    # Start a capture right after the flag is saved (best effort; the cron
    # endpoint picks up anything left unfinished, e.g. after the instance slept).
    flood_inline_processing: bool = os.getenv("FLOOD_INLINE_PROCESSING", "true").lower() == "true"
    flood_cron_budget_seconds: int = int(os.getenv("FLOOD_CRON_BUDGET_SECONDS", "90"))
    # Pepper for hashing client IPs before they are stored; the raw IP is never persisted.
    flood_hash_salt: str = os.getenv("FLOOD_HASH_SALT", "")
    # Which header carries the real client IP behind a proxy (see app/client_ip.py).
    # Empty = the socket peer address. FLOOD_CLIENT_IP_HEADER is the older name.
    client_ip_header: str = (os.getenv("CLIENT_IP_HEADER") or os.getenv("FLOOD_CLIENT_IP_HEADER", "")).lower()
    # Proxies you trust to append one entry each; the entry that many from the
    # right of X-Forwarded-For is the client. 1 = a single trusted proxy.
    client_ip_trusted_hops: int = int(os.getenv("CLIENT_IP_TRUSTED_HOPS", "1"))

    # ReliefWeb API v2 only accepts an appname that ReliefWeb has approved
    # (https://apidoc.reliefweb.int/parameters#appname). Without one the source is
    # skipped as not_configured instead of failing on every sync.
    reliefweb_appname: str = os.getenv("RELIEFWEB_APPNAME", "")

    # Geocoding is server-side only. Configure a self-hosted Photon instance
    # for autocomplete; the backend returns local curated results when unset.
    photon_url: str = os.getenv("PHOTON_URL", "").rstrip("/")
    geocoder_provider: str = os.getenv("GEOCODER_PROVIDER", "geoapify").lower()
    geoapify_api_key: str = os.getenv("GEOAPIFY_API_KEY", "")
    geoapify_base_url: str = os.getenv("GEOAPIFY_BASE_URL", "https://api.geoapify.com/v1/geocode/search").rstrip("/")
    locationiq_access_token: str = os.getenv("LOCATIONIQ_ACCESS_TOKEN", "")
    locationiq_base_url: str = os.getenv("LOCATIONIQ_BASE_URL", "https://us1.locationiq.com/v1/search").rstrip("/")
    geocoder_timeout_seconds: float = float(os.getenv("GEOCODER_TIMEOUT_SECONDS", "3"))
    geocoder_max_results: int = int(os.getenv("GEOCODER_MAX_RESULTS", "8"))
    geocoder_cache_ttl_seconds: int = int(os.getenv("GEOCODER_CACHE_TTL_SECONDS", "300"))
    geocoder_min_query_length: int = int(os.getenv("GEOCODER_MIN_QUERY_LENGTH", "3"))
    geocoder_enable_fallback: bool = os.getenv("GEOCODER_ENABLE_FALLBACK", "true").lower() == "true"

    # Shared secret for the Vercel Cron-triggered sync endpoint. Not a
    # per-user credential — it only proves the caller is Vercel's scheduler
    # (or another holder of the secret), not a real identity.
    cron_secret: str = os.getenv("CRON_SECRET", "")

    # Stopgap RBAC hardening: an X-Role header above public_user/registered_user
    # is only honored when this secret is also presented (see app/security.py).
    # This is NOT real authentication — no per-user identity, no rotation. It
    # exists to stop opportunistic third-party abuse of the spoofable X-Role
    # header until real auth (JWT/OAuth) is built.
    admin_shared_secret: str = os.getenv("ADMIN_SHARED_SECRET", "")

    # Current-event intelligence is opt-in until a deployment has completed
    # the provider, regression, and production verification gates.
    enable_realtime_events: bool = os.getenv("ENABLE_REALTIME_EVENTS", "false").lower() == "true"
    enable_usgs_events: bool = os.getenv("ENABLE_USGS_EVENTS", "true").lower() == "true"
    enable_gdacs_events: bool = os.getenv("ENABLE_GDACS_EVENTS", "true").lower() == "true"
    enable_eonet_enrichment: bool = os.getenv("ENABLE_EONET_ENRICHMENT", "true").lower() == "true"
    enable_reliefweb_enrichment: bool = os.getenv("ENABLE_RELIEFWEB_ENRICHMENT", "true").lower() == "true"
    events_cache_ttl_seconds: int = int(os.getenv("EVENTS_CACHE_TTL_SECONDS", "300"))
    events_max_response_bytes: int = int(os.getenv("EVENTS_MAX_RESPONSE_BYTES", str(2 * 1024 * 1024)))


# The production Neon endpoint. A local or dev run must never point at it — a
# stale copy-pasted .env value would otherwise read or write production data
# from someone's laptop. This is an endpoint id, not a secret.
PRODUCTION_NEON_ENDPOINT_ID = "ep-orange-glitter-b3r4smzw"


def prevent_local_use_of_production_database(settings: Settings) -> None:
    """Fail fast if a non-production run's DATABASE_URL is the production Neon
    branch, instead of letting someone's local script quietly touch production
    data. Pooled and direct hosts both contain the endpoint id, so a plain
    substring check covers either."""
    if settings.environment != "production" and PRODUCTION_NEON_ENDPOINT_ID in settings.database_url:
        raise RuntimeError(
            f"DATABASE_URL points at the production Neon endpoint ({PRODUCTION_NEON_ENDPOINT_ID}) "
            f"but ENVIRONMENT={settings.environment!r}. Local and dev runs must use a separate "
            "Neon branch so they can never read or write production data — see "
            "backend/README.md (Local development). Refusing to start."
        )


def require_durable_state(settings: Settings) -> None:
    """Sync health, the audit log, uploaded-dataset metadata and synced events
    fall back to in-memory stores without DATABASE_URL, so they vanish on every
    restart or sleep and freshness reporting becomes meaningless. Unlike the
    warnings in get_settings(), this fails fast: silently running production on
    throwaway state is the failure mode this guards against."""
    if settings.environment == "production" and not settings.database_url and not settings.allow_ephemeral_state:
        raise RuntimeError(
            "DATABASE_URL is required when ENVIRONMENT=production so sync health, "
            "the audit log and synced events persist. Set DATABASE_URL, or set "
            "ALLOW_EPHEMERAL_STATE=true to knowingly run on in-memory state."
        )


@lru_cache()
def get_settings() -> Settings:
    settings = Settings()

    # Startup check: warn (don't crash) if no AI provider is configured in
    # production. The app still works via the deterministic local-insight
    # fallback either way — this used to hard-require DEEPSEEK_API_KEY
    # specifically and would take down every route if it were unset, which
    # stopped making sense once qwen/together became the primary providers
    # and DeepSeek dropped to a low-priority fallback in pick_provider.
    if settings.environment == "production" and not any([
        settings.qwen_api_key, settings.together_api_key, settings.deepseek_api_key,
        settings.mimo_api_key, settings.openai_api_key, settings.gemini_api_key,
    ]):
        logging.getLogger(__name__).warning(
            "No AI provider API key is configured — running in deterministic "
            "local-insight mode. Set QWEN_API_KEY, TOGETHER_API_KEY, or another "
            "provider key to enable LLM-generated responses."
        )

    # The /api/cron/sync-sources endpoint itself already fails closed (403)
    # when cron_secret is unset — see main.py's cron_sync_sources — so an
    # unset secret can't actually be exploited. Warn instead of crashing the
    # whole app at startup; a hard failure here would take down every route,
    # not just the cron endpoint, over one optional feature being unconfigured.
    if settings.environment == "production" and not settings.cron_secret:
        logging.getLogger(__name__).warning(
            "CRON_SECRET is not set — /api/cron/sync-sources will reject all "
            "requests (including Vercel's own scheduler) until it's configured."
        )

    prevent_local_use_of_production_database(settings)
    require_durable_state(settings)

    return settings
