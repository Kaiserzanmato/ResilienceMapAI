"""Security middleware: sliding-window rate limiting, audit logging, and the
RBAC-ready role model. Auth is structure-ready: requests carry an optional
bearer token; the MVP maps absent tokens to the public_user role."""
import logging
import time
from collections import defaultdict, deque
from typing import Deque, Dict

from fastapi import HTTPException, Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

from .config import get_settings

audit_logger = logging.getLogger("resiliencemap.audit")
handler = logging.StreamHandler()
handler.setFormatter(logging.Formatter("%(asctime)s AUDIT %(message)s"))
audit_logger.addHandler(handler)
audit_logger.setLevel(logging.INFO)
audit_logger.propagate = False

ROLES = ["public_user", "registered_user", "analyst", "organization_admin",
         "dataset_admin", "super_admin"]

# Roles above these two grant real privileges (dataset mutation, org admin,
# etc.) and require ADMIN_SHARED_SECRET alongside X-Role — see get_role().
ELEVATED_ROLES = {"analyst", "organization_admin", "dataset_admin", "super_admin"}

# role -> allowed permission scopes (enforced on dataset mutation for the MVP)
ROLE_PERMISSIONS = {
    "public_user": {"read"},
    "registered_user": {"read", "export"},
    "analyst": {"read", "export", "compare"},
    "organization_admin": {"read", "export", "compare", "manage_org"},
    "dataset_admin": {"read", "export", "compare", "manage_datasets"},
    "super_admin": {"read", "export", "compare", "manage_org", "manage_datasets", "admin"},
}


def get_role(request: Request) -> str:
    """MVP role resolution: an X-Role header simulates authenticated roles for
    local development; production swaps this for JWT verification.

    Stopgap hardening: X-Role alone is fully client-controlled (the frontend
    itself sends `x-role: dataset_admin` on every dataset upload), so any
    caller could otherwise grant themselves an elevated role. Until real
    auth exists, an elevated role additionally requires a matching
    `Authorization: Bearer <ADMIN_SHARED_SECRET>` header — NOT real
    authentication (one static secret, no per-user identity, no rotation),
    just a bar against opportunistic third-party abuse of the header.
    """
    role = request.headers.get("x-role", "public_user")
    if role not in ROLES:
        return "public_user"
    if role in ELEVATED_ROLES:
        secret = get_settings().admin_shared_secret
        if not secret or request.headers.get("authorization") != f"Bearer {secret}":
            return "public_user"
    return role


def require_permission(request: Request, permission: str) -> None:
    role = get_role(request)
    if permission not in ROLE_PERMISSIONS[role]:
        raise HTTPException(status_code=403, detail=f"Role '{role}' lacks '{permission}' permission")


class RateLimitMiddleware(BaseHTTPMiddleware):
    """In-memory sliding window per client IP; AI endpoints get a tighter
    budget. Swap the store for Redis in multi-instance deployments."""

    def __init__(self, app):
        super().__init__(app)
        self.hits: Dict[str, Deque[float]] = defaultdict(deque)
        self.ai_hits: Dict[str, Deque[float]] = defaultdict(deque)

    async def dispatch(self, request: Request, call_next):
        s = get_settings()
        ip = request.client.host if request.client else "unknown"
        now = time.time()
        window = s.rate_limit_window_seconds

        # scope["path"] (not request.url.path): starlette <1.1 rebuilds
        # request.url by concatenating the Host header with the path and
        # re-parsing — a malformed Host header can desync the two
        # (PYSEC-2026-161/248), letting a caller dodge the tighter AI
        # rate-limit bucket while still routing to an /api/ai endpoint.
        # scope["path"] is the raw ASGI path the router itself dispatched
        # on, unaffected by Host-header reconstruction.
        is_ai = request.scope["path"].startswith(("/api/ai", "/api/agent"))
        bucket = self.ai_hits[ip] if is_ai else self.hits[ip]
        limit = s.ai_rate_limit_requests if is_ai else s.rate_limit_requests

        while bucket and bucket[0] < now - window:
            bucket.popleft()
        if len(bucket) >= limit:
            audit_logger.info("RATE_LIMITED ip=%s path=%s", ip, request.scope["path"])
            # Return directly: HTTPException raised inside BaseHTTPMiddleware
            # bypasses FastAPI's handlers and would surface as a 500.

            # User-friendly message for Ask AI with explanation
            if is_ai:
                message = (
                    f"You've reached the Ask AI rate limit ({limit} queries per {window} seconds). "
                    f"Please wait {window} seconds before trying again. This limit helps ensure fair "
                    f"access for all users and maintains service stability."
                )
            else:
                message = "Rate limit exceeded. Try again shortly."

            return JSONResponse(
                status_code=429,
                content={
                    "detail": message,
                    "retry_after_seconds": window,
                    "limit": limit,
                    "window_seconds": window,
                },
                headers={"Retry-After": str(window)},
            )
        bucket.append(now)
        return await call_next(request)


class AuditLogMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        start = time.time()
        response = await call_next(request)
        path = request.scope["path"]  # see RateLimitMiddleware for why not request.url.path
        if path.startswith("/api"):
            audit_logger.info(
                "ip=%s role=%s method=%s path=%s status=%s ms=%d",
                request.client.host if request.client else "unknown",
                get_role(request), request.method, path,
                response.status_code, (time.time() - start) * 1000,
            )
        return response
