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
    chat_quota_limit: int = int(os.getenv("CHAT_QUOTA_LIMIT", "50"))

    # Database (RBAC/auth-ready; the MVP runs on curated sample datasets)
    database_url: str = os.getenv("DATABASE_URL", "")
    redis_url: str = os.getenv("REDIS_URL", "")

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

    return settings
