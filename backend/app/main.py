"""ResilienceMap AI — FastAPI backend.

All AI calls are server-side; risk scoring is deterministic; every /api route
is rate-limited and audit-logged.
"""
from datetime import datetime, timezone

from fastapi import FastAPI, HTTPException, Query, Request, Response
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .data.sample_hazards import ACTIVE_ALERTS, DATASETS, HAZARD_EVENTS
from .schemas import (AgentQueryRequest, AIReportRequest, AISummaryRequest,
                      AskAIRequest, CompareRequest, DatasetUpload, ExportCSVRequest,
                      ExportPDFRequest, ShareLinkRequest)
from .security import AuditLogMiddleware, RateLimitMiddleware, require_permission
from .services import geospatial_query as geo
from .services.ask_ai import ask_ai_guardrailed
from .services.dashboard import dashboard_stats
from .services.ai_router import DISCLAIMER, generate_insight
from .services.exporters import (build_pdf_report, get_report, list_reports,
                                 risks_to_csv, store_report)
from .services.risk_scoring import compare_locations, score_location

settings = get_settings()
app = FastAPI(title=settings.app_name, version=settings.version)

app.add_middleware(RateLimitMiddleware)
app.add_middleware(AuditLogMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_origins.split(",")],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

# Runtime registry of uploaded dataset metadata (in addition to curated DATASETS)
_uploaded_datasets = []


@app.get("/health")
def health():
    return {"status": "ok", "service": settings.app_name, "version": settings.version,
            "time": datetime.now(timezone.utc).isoformat()}


# ---------------------------------------------------------------- risk
@app.get("/api/location-risk")
def location_risk(lat: float = Query(..., ge=-90, le=90),
                  lng: float = Query(..., ge=-180, le=180),
                  name: str = Query(None, max_length=120)):
    return score_location(lat, lng, name)


@app.post("/api/compare-locations")
def compare(req: CompareRequest):
    return {"results": compare_locations([l.model_dump() for l in req.locations])}


@app.get("/api/geocode")
def geocode(q: str = Query(..., min_length=1, max_length=80)):
    return {"results": geo.search_locations(q)}


# ---------------------------------------------------------------- hazards
@app.get("/api/hazard-layers")
def hazard_layers(layer: str = Query("overall", max_length=32),
                  format: str = Query("geojson", max_length=16)):
    valid = {l["key"] for l in geo.available_layers()}
    if layer not in valid:
        raise HTTPException(400, f"Unknown layer '{layer}'. Valid: {sorted(valid)}")
    if format == "heatmap":
        return geo.heatmap_points(layer)
    return geo.hazard_layer_geojson(layer)


@app.get("/api/hazard-layers/index")
def hazard_layer_index():
    return {"layers": geo.available_layers()}


@app.get("/api/dashboard-stats")
def dashboard():
    return dashboard_stats()


@app.get("/api/hazard-events")
def hazard_events():
    return {"events": HAZARD_EVENTS, "alerts": ACTIVE_ALERTS}


# ---------------------------------------------------------------- AI
@app.post("/api/ai/summary")
async def ai_summary(req: AISummaryRequest):
    risk = score_location(req.lat, req.lng, req.name)
    result = await generate_insight("summary", risk,
                                    "Summarize the risk profile for this location.",
                                    req.persona, req.provider)
    return {"risk": risk, **result}


@app.post("/api/ai/report")
async def ai_report(req: AIReportRequest):
    risk = score_location(req.lat, req.lng, req.name)
    result = await generate_insight(
        "report", risk,
        "Write an executive risk briefing for this location: overview, hazard "
        "analysis, exposure considerations, and recommended next steps.",
        req.persona)
    return {"risk": risk, **result}


@app.post("/api/agent/query")
async def agent_query(req: AgentQueryRequest):
    risk = None
    if req.lat is not None and req.lng is not None:
        risk = score_location(req.lat, req.lng, req.location_name)
    result = await generate_insight("agent", risk, req.message, req.persona, req.provider)
    return {"risk": risk, **result}


@app.post("/api/ask-ai")
async def ask_ai(req: AskAIRequest):
    """Ask AI with disaster intelligence guardrails.

    Enforces scope checking (disaster/hazard/resilience only), source attribution,
    and approved source usage. Returns grounded answers with citations or scope
    refusal message if query is unrelated to disasters/hazards.
    """
    result = await ask_ai_guardrailed(
        query=req.query,
        lat=req.lat,
        lng=req.lng,
        location_name=req.location_name,
        persona=req.persona,
        provider=req.provider,
    )
    return result


# ---------------------------------------------------------------- export
@app.post("/api/export/pdf")
async def export_pdf(req: ExportPDFRequest, request: Request):
    risk = score_location(req.lat, req.lng, req.name)
    summary = await generate_insight("report", risk,
                                     "Write a concise risk summary for a PDF report.",
                                     req.persona)
    pdf = build_pdf_report(risk, req.persona, summary["answer"], map_image=req.map_image)
    filename = f"resiliencemap-{risk['location_name'].lower().replace(' ', '-')}.pdf"
    return Response(content=pdf, media_type="application/pdf",
                    headers={"Content-Disposition": f'attachment; filename="{filename}"'})


@app.post("/api/export/csv")
def export_csv(req: ExportCSVRequest):
    risks = compare_locations([l.model_dump() for l in req.locations])
    csv_text = risks_to_csv(risks)
    return Response(content=csv_text, media_type="text/csv",
                    headers={"Content-Disposition": 'attachment; filename="resiliencemap-export.csv"'})


@app.post("/api/export/share-link")
async def share_link(req: ShareLinkRequest):
    risk = score_location(req.lat, req.lng, req.name)
    summary = await generate_insight("summary", risk,
                                     "Summarize the risk profile for this location.",
                                     req.persona)
    report_id = store_report({"risk": risk, "summary": summary["answer"],
                              "persona": req.persona, "sources": summary["sources"],
                              "disclaimer": DISCLAIMER})
    return {"report_id": report_id, "path": f"/reports/shared/{report_id}"}


# ---------------------------------------------------------------- reports
@app.get("/api/reports")
def reports_index():
    return {"reports": [
        {"id": r["id"], "location": r["risk"]["location_name"],
         "persona": r["persona"], "created_at": r["created_at"],
         "overall": r["risk"]["overall"]}
        for r in list_reports()
    ]}


@app.get("/api/reports/{report_id}")
def report_detail(report_id: str):
    report = get_report(report_id)
    if not report:
        raise HTTPException(404, "Report not found or link expired")
    return report


# ---------------------------------------------------------------- datasets
@app.get("/api/datasets")
def datasets():
    return {"datasets": DATASETS + _uploaded_datasets}


@app.post("/api/datasets/upload")
def upload_dataset(meta: DatasetUpload, request: Request):
    require_permission(request, "manage_datasets")
    entry = meta.model_dump()
    entry.update({
        "id": f"ds-up-{len(_uploaded_datasets) + 1}",
        "updated": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "status": "pending_review",
    })
    _uploaded_datasets.append(entry)
    return {"dataset": entry, "message": "Dataset metadata registered for review."}
