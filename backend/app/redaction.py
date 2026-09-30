"""Scrub secrets from text before it is logged or returned.

httpx puts the full request URL in its exception messages, and some providers
(NASA FIRMS) carry their API key in the URL path. Anything that logs an
exception from an outbound call should pass the text through redact_secrets().
"""
from __future__ import annotations

import logging
import re
from typing import Iterable

from .config import get_settings

REDACTED = "[REDACTED]"
# Shortest configured secret we will blindly substring-replace; shorter values
# (e.g. a test placeholder like "x") would mangle unrelated text.
_MIN_SECRET_LENGTH = 4
# FIRMS embeds the MAP_KEY as the path segment after /api/area/csv/.
_FIRMS_KEY_IN_URL = re.compile(r"(/api/area/csv/)[^/\s'\"]+")


def _configured_secrets() -> list[str]:
    settings = get_settings()
    return [settings.nasa_firms_map_key, settings.cron_secret, settings.admin_shared_secret]


def redact_secrets(text: object, extra: Iterable[str] = ()) -> str:
    """Return str(text) with configured secrets, `extra` values, and the FIRMS
    URL key segment replaced by [REDACTED]. Longest secrets are replaced first
    so one secret that contains another is not left partially exposed."""
    cleaned = _FIRMS_KEY_IN_URL.sub(rf"\1{REDACTED}", str(text))
    secrets = {s for s in (*_configured_secrets(), *extra) if s and len(s) >= _MIN_SECRET_LENGTH}
    for secret in sorted(secrets, key=len, reverse=True):
        cleaned = cleaned.replace(secret, REDACTED)
    return cleaned


class SecretRedactingFilter(logging.Filter):
    """Scrub secrets from records emitted by third-party loggers we don't control.

    httpx logs every request at INFO as `HTTP Request: GET <full url> "..."`, which
    includes the FIRMS MAP_KEY whenever INFO logging is enabled."""

    def filter(self, record: logging.LogRecord) -> bool:
        record.msg = redact_secrets(record.getMessage())
        record.args = ()
        return True


_HTTP_CLIENT_LOGGERS = ("httpx", "httpcore")


def install_log_redaction() -> None:
    """Attach SecretRedactingFilter to the HTTP client loggers (idempotent)."""
    for name in _HTTP_CLIENT_LOGGERS:
        target = logging.getLogger(name)
        if not any(isinstance(f, SecretRedactingFilter) for f in target.filters):
            target.addFilter(SecretRedactingFilter())
