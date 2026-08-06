"""Pydantic request/response schemas — input validation boundary."""
import base64
import binascii
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field, field_validator


class LocationQuery(BaseModel):
    lat: float = Field(..., ge=-90, le=90)
    lng: float = Field(..., ge=-180, le=180)
    name: Optional[str] = Field(None, max_length=120)


class GlobalAssessmentRequest(LocationQuery):
    country_code: Optional[str] = Field(None, min_length=2, max_length=2)
    geometry_type: str = Field("point", max_length=32)

    @field_validator("country_code")
    @classmethod
    def country_code_safe(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and not v.isalpha():
            raise ValueError("country_code must be an ISO alpha-2 code")
        return v.upper() if v else None


class CompareRequest(BaseModel):
    locations: List[LocationQuery] = Field(..., min_length=2, max_length=6)


class AISummaryRequest(BaseModel):
    lat: float = Field(..., ge=-90, le=90)
    lng: float = Field(..., ge=-180, le=180)
    name: Optional[str] = Field(None, max_length=120)
    persona: str = Field("citizen", max_length=32)
    provider: Optional[str] = Field(None, max_length=24)

    @field_validator("persona")
    @classmethod
    def persona_safe(cls, v: str) -> str:
        return "".join(c for c in v if c.isalnum() or c == "_")[:32] or "citizen"


class AgentQueryRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000)
    persona: str = Field("citizen", max_length=32)
    provider: Optional[str] = Field(None, max_length=24)
    lat: Optional[float] = Field(None, ge=-90, le=90)
    lng: Optional[float] = Field(None, ge=-180, le=180)
    location_name: Optional[str] = Field(None, max_length=120)
    risk_context: Optional[str] = Field(None, max_length=8000)
    mapTargetContext: Optional[str] = Field(None, max_length=4000)


class AIReportRequest(BaseModel):
    lat: float = Field(..., ge=-90, le=90)
    lng: float = Field(..., ge=-180, le=180)
    name: Optional[str] = Field(None, max_length=120)
    persona: str = Field("citizen", max_length=32)


class ExportPDFRequest(BaseModel):
    lat: float = Field(..., ge=-90, le=90)
    lng: float = Field(..., ge=-180, le=180)
    name: Optional[str] = Field(None, max_length=120)
    persona: str = Field("citizen", max_length=32)
    # Optional client-captured map snapshot (PNG data URL), embedded in the PDF
    map_image: Optional[str] = Field(None, max_length=4_000_000)

    @field_validator("map_image")
    @classmethod
    def png_data_url_only(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and not v.startswith("data:image/png;base64,"):
            raise ValueError("map_image must be a PNG data URL")
        return v


class ExportCSVRequest(BaseModel):
    locations: List[LocationQuery] = Field(..., min_length=1, max_length=50)


class ShareLinkRequest(BaseModel):
    lat: float = Field(..., ge=-90, le=90)
    lng: float = Field(..., ge=-180, le=180)
    name: Optional[str] = Field(None, max_length=120)
    persona: str = Field("citizen", max_length=32)


class AskAIRequest(BaseModel):
    """Ask AI query with optional location context."""
    query: str = Field(..., min_length=1, max_length=2000)
    persona: str = Field("citizen", max_length=32)
    provider: Optional[str] = Field(None, max_length=24)
    lat: Optional[float] = Field(None, ge=-90, le=90)
    lng: Optional[float] = Field(None, ge=-180, le=180)
    location_name: Optional[str] = Field(None, max_length=120)
    mapTargetContext: Optional[str] = Field(None, max_length=4000)

    @field_validator("persona")
    @classmethod
    def persona_safe(cls, v: str) -> str:
        return "".join(c for c in v if c.isalnum() or c == "_")[:32] or "citizen"


class SpatialVisionRequest(BaseModel):
    """Multimodal AI request: a rendered map viewport snapshot plus
    deterministic risk context, for the vision-capable model to ground its
    analysis against (see services/spatial_vision.py)."""
    user_query: str = Field(..., min_length=1, max_length=1000)
    persona: str = Field("analyst", max_length=32)
    # 1.5M chars of base64 bounds the request body to ~1.1MB decoded — well
    # above the ~150KB a correctly-optimized snapshot (spatialVision.ts:
    # 1024px max width, JPEG q=0.7) produces, while still rejecting grossly
    # oversized payloads before they reach the provider.
    map_image_base64: str = Field(..., min_length=1, max_length=1_500_000)
    lat: float = Field(..., ge=-90, le=90)
    lng: float = Field(..., ge=-180, le=180)
    deterministic_scores: Dict[str, Any] = Field(default_factory=dict)
    active_layers: List[str] = Field(default_factory=list)

    @field_validator("persona")
    @classmethod
    def persona_safe(cls, v: str) -> str:
        return "".join(c for c in v if c.isalnum() or c == "_")[:32] or "analyst"

    @field_validator("map_image_base64")
    @classmethod
    def jpeg_data_url_only(cls, v: str) -> str:
        prefix = "data:image/jpeg;base64,"
        if not v.startswith(prefix):
            raise ValueError("map_image_base64 must be a JPEG data URL (data:image/jpeg;base64,...)")
        payload = v[len(prefix):]
        if not payload:
            raise ValueError("map_image_base64 payload is empty")
        try:
            decoded = base64.b64decode(payload, validate=True)
        except binascii.Error as exc:
            raise ValueError("map_image_base64 is not valid base64") from exc
        # A blank/near-blank canvas snapshot is still a few hundred bytes of
        # JPEG container overhead; anything smaller is truncated or bogus.
        if len(decoded) < 100:
            raise ValueError("map_image_base64 decodes to an implausibly small image")
        if len(decoded) > 1_200_000:
            raise ValueError("map_image_base64 exceeds the maximum allowed decoded size (1.2MB)")
        if decoded[:2] != b"\xff\xd8":
            raise ValueError("map_image_base64 does not decode to a valid JPEG (bad magic bytes)")
        return v


class DataStatusResponse(BaseModel):
    """Current data freshness and sync status."""
    data_type: str  # "real-time", "synced", "static", "mock"
    last_sync_timestamp: Optional[str] = None
    sources_status: Dict[str, str] = Field(default_factory=dict)  # {source_id: "synced"/"failed"/"manual"}
    sync_method: str  # "api", "scheduled", "manual", "static-file"
    is_fresh: bool  # True if data is < 24 hours old
    message: str


class DatasetUpload(BaseModel):
    """Dataset metadata validation for the admin upload flow."""
    name: str = Field(..., min_length=3, max_length=120)
    agency: str = Field(..., min_length=2, max_length=80)
    category: str = Field(..., max_length=40)
    url: str = Field(..., max_length=300)
    confidence: str = Field("Medium", max_length=12)
    records: int = Field(0, ge=0)

    @field_validator("url")
    @classmethod
    def https_only(cls, v: str) -> str:
        if not v.startswith("https://"):
            raise ValueError("Dataset source URL must use HTTPS")
        return v

    @field_validator("confidence")
    @classmethod
    def confidence_enum(cls, v: str) -> str:
        if v not in {"High", "Medium", "Low"}:
            raise ValueError("confidence must be High, Medium, or Low")
        return v
