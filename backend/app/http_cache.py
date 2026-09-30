"""ETag / Cache-Control helpers keyed by the data version.

`data_version` is the newest successful sync timestamp (see
source_sync_health.get_data_version), so a completed sync changes every ETag and
clients revalidate; between syncs they get cheap 304s.
"""
from __future__ import annotations

import hashlib
from typing import Any

from fastapi import Request, Response
from fastapi.responses import JSONResponse

CACHE_CONTROL = "public, max-age=60, stale-while-revalidate=300"


def cached_json(request: Request, payload: Any, version: str) -> Response:
    """JSON response with a weak ETag derived from (version, path, query).
    Returns 304 with no body when the client's If-None-Match already matches."""
    digest = hashlib.sha1(f"{version}|{request.url.path}?{request.url.query}".encode()).hexdigest()[:20]
    etag = f'W/"{digest}"'
    headers = {"ETag": etag, "Cache-Control": CACHE_CONTROL, "X-Data-Version": version}
    candidates = {token.strip() for token in request.headers.get("if-none-match", "").split(",")}
    if etag in candidates or "*" in candidates:
        return Response(status_code=304, headers=headers)
    return JSONResponse(content=payload, headers=headers)
