"""Shared pytest fixtures.

Resets in-memory usage-quota state (app/services/usage_quota.py) before
and after every test. Quota buckets are keyed by client IP, and
TestClient always reports "testclient" — without this, quota consumed by
one test's calls to /api/generate-insights, /api/ask-ai, or
/api/agent/query would carry over and affect unrelated tests later in the
same pytest session. This is the exact class of bug already found once
for RateLimitMiddleware's shared IP-keyed bucket — see AUDIT_REPORT.md
finding #20 — recurring for a second in-memory-state module was reason
enough to fix it generically here rather than with another one-off
per-file fixture.
"""
import pytest

from app.services import usage_quota


@pytest.fixture(autouse=True)
def _reset_usage_quota():
    usage_quota._insights_hits.clear()
    usage_quota._chat_counts.clear()
    yield
    usage_quota._insights_hits.clear()
    usage_quota._chat_counts.clear()
