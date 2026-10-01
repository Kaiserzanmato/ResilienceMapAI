"""Flood auto-capture API. Every /api/flood route 404s until ENABLE_FLOOD_CAPTURE
is on. This module deliberately imports none of the raster stack (see worker.py)."""
from __future__ import annotations

import hashlib
import hmac
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Request, Response
from pydantic import BaseModel, Field, field_validator

from ..client_ip import client_ip
from ..config import get_settings
from ..http_cache import cached_json
from ..repositories.flood_repo import MAX_FEATURES, Bbox, get_flood_repo
from .reasons import REASON_LABELS
from .worker import drain_queue, run_job_now

MAX_BBOX_SPAN_DEG = 30.0
MIN_TILE_ZOOM = 8
MAX_OBSERVATION_AGE = timedelta(days=30)
ATTRIBUTION = ("Contains modified Copernicus Sentinel data (ESA). Satellite-derived water extent, "
               "not an official flood map.")


def require_enabled() -> None:
    if not get_settings().enable_flood_capture:
        raise HTTPException(404, "Flood capture is not enabled")


router = APIRouter(prefix="/api/flood", dependencies=[Depends(require_enabled)])
cron_router = APIRouter()


class FloodFlagRequest(BaseModel):
    lat: float = Field(..., ge=-90, le=90)
    lng: float = Field(..., ge=-180, le=180)
    note: str | None = Field(None, max_length=280)
    observed_at: datetime | None = None

    @field_validator("note")
    @classmethod
    def blank_note_is_none(cls, v: str | None) -> str | None:
        v = (v or "").strip()
        return v or None

    @field_validator("observed_at")
    @classmethod
    def plausible_time(cls, v: datetime | None) -> datetime | None:
        if v is None:
            return None
        v = v if v.tzinfo else v.replace(tzinfo=timezone.utc)
        now = datetime.now(timezone.utc)
        if v > now + timedelta(minutes=5):
            raise ValueError("observed_at cannot be in the future")
        if v < now - MAX_OBSERVATION_AGE:
            raise ValueError("observed_at is older than 30 days")
        return v


def client_hash(request: Request) -> str:
    """HMAC of the client IP. The raw address is never stored or logged here."""
    settings = get_settings()
    pepper = settings.flood_hash_salt or settings.cron_secret or "resiliencemap-flood"
    return hmac.new(pepper.encode(), client_ip(request).encode(), hashlib.sha256).hexdigest()


def parse_bbox(raw: str | None) -> Bbox | None:
    if raw is None:
        return None
    try:
        west, south, east, north = (float(part) for part in raw.split(","))
    except ValueError:
        raise HTTPException(422, "bbox must be west,south,east,north") from None
    if not (-180 <= west < east <= 180 and -90 <= south < north <= 90):
        raise HTTPException(422, "bbox is out of range or inverted")
    if east - west > MAX_BBOX_SPAN_DEG or north - south > MAX_BBOX_SPAN_DEG:
        raise HTTPException(422, f"bbox may span at most {MAX_BBOX_SPAN_DEG:g} degrees")
    return west, south, east, north


@router.post("/flags", status_code=202)
async def create_flag(body: FloodFlagRequest, request: Request, background: BackgroundTasks):
    settings = get_settings()
    repo = get_flood_repo()
    who = client_hash(request)
    if await repo.count_recent_flags(who, 3600) >= settings.flood_flags_per_hour:
        raise HTTPException(
            429, f"Flag limit reached ({settings.flood_flags_per_hour} per hour). Try again later.",
            headers={"Retry-After": "3600"},
        )
    flag = await repo.create_flag(body.lat, body.lng, body.note, body.observed_at, who)
    job = await repo.create_job(flag["id"])
    if settings.flood_inline_processing:
        background.add_task(run_job_now, job["id"])  # runs after the response is sent
    return {"flag_id": flag["id"], "job_id": job["id"], "status": job["status"]}


@router.get("/jobs/{job_id}")
async def get_job(job_id: int):
    job = await get_flood_repo().get_job(job_id)
    if job is None:
        raise HTTPException(404, "Job not found")
    return {
        "id": job["id"], "flag_id": job["flag_id"], "status": job["status"], "attempts": job["attempts"],
        "reason_code": job["reason_code"], "message": REASON_LABELS.get(job["reason_code"] or ""),
        "extent": job["extent"],  # includes aoi_bbox, so the client can zoom to the capture
        "created_at": job["created_at"].isoformat(), "updated_at": job["updated_at"].isoformat(),
    }


@router.get("/extents")
async def list_extents(request: Request, bbox: str | None = Query(None, max_length=100), since: datetime | None = None):
    repo = get_flood_repo()
    features, truncated = await repo.list_extents(parse_bbox(bbox), since, MAX_FEATURES)
    payload = {"type": "FeatureCollection", "features": features, "truncated": truncated,
               "attribution": ATTRIBUTION}
    return cached_json(request, payload, await repo.extents_version())


@router.get("/flags")
async def list_flags(bbox: str | None = Query(None, max_length=100)):
    features, truncated = await get_flood_repo().list_flags(parse_bbox(bbox), MAX_FEATURES)
    return {"type": "FeatureCollection", "features": features, "truncated": truncated}


@router.get("/tiles/{z}/{x}/{y}.mvt")
async def tile(z: int, x: int, y: int):
    if not (0 <= z <= 22 and 0 <= x < 2 ** z and 0 <= y < 2 ** z):
        raise HTTPException(404, "Tile out of range")
    if z < MIN_TILE_ZOOM:
        return Response(status_code=204)
    data = await get_flood_repo().tile(z, x, y)
    if not data:
        return Response(status_code=204)
    return Response(content=data, media_type="application/vnd.mapbox-vector-tile",
                    headers={"Cache-Control": "public, max-age=300"})


@cron_router.get("/api/cron/flood-captures")
async def cron_flood_captures(request: Request):
    """Drain unfinished capture jobs. Same guard as /api/cron/sync-sources:
    a Bearer CRON_SECRET, and it fails closed when the secret is unset."""
    settings = get_settings()
    provided = request.headers.get("authorization", "")
    if not settings.cron_secret or not hmac.compare_digest(provided.encode(), f"Bearer {settings.cron_secret}".encode()):
        raise HTTPException(403, "Forbidden")
    if not settings.enable_flood_capture:
        return {"enabled": False}
    return {"enabled": True, **await drain_queue()}
