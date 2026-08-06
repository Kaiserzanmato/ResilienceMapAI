"""Long-window per-IP usage quotas, separate from RateLimitMiddleware's
short-window burst protection (app/security.py). Two independently tracked
tiers:

  - "insights": a tight sliding-window cap. Each hit is one expensive full
    AI generation triggered by a single button click (Insights).
  - "chat": a broader daily cap, reset at UTC midnight, shared by the AI
    Agent panel and AI Workspace chat — conversational messages are
    lighter and more frequent than a single Insights generation.

In-memory, single-instance — same caveat as RateLimitMiddleware; swap for
Redis in multi-instance deployments. Keyed by client IP, since the app has
no per-user identity (see app/security.py's get_role() docstring).
"""
import time
from collections import defaultdict, deque
from dataclasses import asdict, dataclass
from datetime import datetime, timedelta, timezone
from typing import Deque, Dict, Literal

from fastapi import HTTPException, Request

from ..config import get_settings

Bucket = Literal["insights", "chat"]

# "insights": sliding window of hit timestamps per IP.
_insights_hits: Dict[str, Deque[float]] = defaultdict(deque)
# "chat": calendar-day (UTC) counter per IP — (date_str, count).
_chat_counts: Dict[str, tuple[str, int]] = {}


@dataclass
class UsageStatus:
    bucket: Bucket
    used: int
    limit: int
    remaining: int
    resets_in_seconds: int
    resets_at: str  # ISO 8601 UTC

    def to_dict(self) -> dict:
        return asdict(self)


def _today_utc() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def _midnight_utc_tomorrow() -> datetime:
    now = datetime.now(timezone.utc)
    return (now + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)


def _insights_status(key: str) -> UsageStatus:
    s = get_settings()
    limit, window = s.insights_quota_limit, s.insights_quota_window_seconds
    now = time.time()
    dq = _insights_hits[key]
    while dq and dq[0] < now - window:
        dq.popleft()
    used = len(dq)
    resets_in = max(0, int((dq[0] + window) - now)) if dq else 0
    resets_at = datetime.fromtimestamp(
        (dq[0] + window) if dq else now, tz=timezone.utc
    ).isoformat()
    return UsageStatus(
        bucket="insights", used=used, limit=limit, remaining=max(0, limit - used),
        resets_in_seconds=resets_in, resets_at=resets_at,
    )


def _chat_status(key: str) -> UsageStatus:
    s = get_settings()
    limit = s.chat_quota_limit
    today = _today_utc()
    date_str, count = _chat_counts.get(key, (today, 0))
    used = count if date_str == today else 0
    reset_at_dt = _midnight_utc_tomorrow()
    resets_in = max(0, int((reset_at_dt - datetime.now(timezone.utc)).total_seconds()))
    return UsageStatus(
        bucket="chat", used=used, limit=limit, remaining=max(0, limit - used),
        resets_in_seconds=resets_in, resets_at=reset_at_dt.isoformat(),
    )


def client_key(request: Request) -> str:
    """Same IP-keying as RateLimitMiddleware (app/security.py) — no
    per-user identity exists yet, see get_role()'s docstring there."""
    return request.client.host if request.client else "unknown"


def get_status(bucket: Bucket, key: str) -> UsageStatus:
    """Read-only — does not consume a hit."""
    return _insights_status(key) if bucket == "insights" else _chat_status(key)


def consume(bucket: Bucket, key: str) -> UsageStatus:
    """Records a hit and returns the updated status. Raises HTTPException(429)
    if the quota was already exhausted (the hit is NOT recorded in that case)."""
    status = get_status(bucket, key)
    if status.remaining <= 0:
        raise HTTPException(
            status_code=429,
            detail={
                "message": (
                    f"You've used all {status.limit} {bucket} requests for this "
                    f"period. Try again after {status.resets_at}."
                ),
                "bucket": bucket,
                "limit": status.limit,
                "resets_in_seconds": status.resets_in_seconds,
                "resets_at": status.resets_at,
            },
            headers={"Retry-After": str(status.resets_in_seconds)},
        )
    if bucket == "insights":
        _insights_hits[key].append(time.time())
    else:
        today = _today_utc()
        date_str, count = _chat_counts.get(key, (today, 0))
        _chat_counts[key] = (today, (count + 1) if date_str == today else 1)
    return get_status(bucket, key)
