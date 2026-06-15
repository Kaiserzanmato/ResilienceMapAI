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
                      AskAIRequest, CompareRequest, DatasetUpload, DataStatusResponse,
                      ExportCSVRequest, ExportPDFRequest, ShareLinkRequest)
from .security import AuditLogMiddleware, RateLimitMiddleware, require_permission
from .services import geospatial_query as geo
from .services.ask_ai import ask_ai_guardrailed
from .services.dashboard import dashboard_stats
from .services.insights_generator import generate_insights
from .services.ai_router import DISCLAIMER, generate_insight
from .services.exporters import (build_pdf_report, get_report, list_reports,
                                 risks_to_csv, store_report)
from .services.risk_scoring import compare_locations, score_location
from .services.providers import build_providers

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


@app.get("/api/ai-provider-info")
def ai_provider_info():
    """Return configured AI provider and model information (non-secret)."""
    return {
        "provider": "deepseek",
        "model": settings.deepseek_model,
        "provider_display": "DeepSeek",
        "model_display": f"DeepSeek {settings.deepseek_model.replace('deepseek-', '').title()}",
    }


# ---------------------------------------------------------------- risk
@app.get("/api/location-risk")
def location_risk(lat: float = Query(..., ge=-90, le=90),
                  lng: float = Query(..., ge=-180, le=180),
                  name: str = Query(None, max_length=120),
                  country_code: str = Query(None, max_length=2)):
    return score_location(lat, lng, name, country_code)


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
    import json as _json
    from .services.query_processor import (
        classify_query, QueryIntent, get_top_risk_locations,
        get_conflict_high_risk_areas, compare_locations,
        format_ranking_response, format_comparison_response, format_conflict_response,
    )

    risk = None
    if req.lat is not None and req.lng is not None:
        risk = score_location(req.lat, req.lng, req.location_name)

    # Classify the user's query intent
    intent, params = classify_query(req.message)

    # Route to appropriate handler based on query intent
    if intent == QueryIntent.RANKING and not (req.lat and req.lng):
        # Global ranking query - use structured data instead of generate_insight
        hazard = params.get("hazard")
        locations = get_top_risk_locations(hazard=hazard, limit=8)
        answer = format_ranking_response(intent, hazard, locations)
        return {
            "risk": risk,
            "answer": answer,
            "model": "query-processor (deterministic)",
            "persona": req.persona,
            "sources": [],
            "confidence": "Medium",
            "flagged_input": False,
            "disclaimer": "Rankings based on ResilienceMap curated hazard zones and global country-level risk baselines. Not an official advisory.",
        }

    elif intent == QueryIntent.COMPARISON and "locations" in params:
        # Comparison query
        locs = params.get("locations", [])
        comparison_data = compare_locations(locs)
        answer = format_comparison_response(comparison_data.get("locations", []))
        return {
            "risk": risk,
            "answer": answer,
            "model": "query-processor (deterministic)",
            "persona": req.persona,
            "sources": [],
            "confidence": "Medium",
            "flagged_input": False,
            "disclaimer": "Comparison based on ResilienceMap curated hazard data. Not an official advisory.",
        }

    elif intent == QueryIntent.CONFLICT:
        # Conflict query
        areas = get_conflict_high_risk_areas()
        answer = format_conflict_response(areas)
        return {
            "risk": risk,
            "answer": answer,
            "model": "query-processor (deterministic)",
            "persona": req.persona,
            "sources": [],
            "confidence": "Medium",
            "flagged_input": False,
            "disclaimer": "Conflict risk is indicative. Consult official sources for current geopolitical status.",
        }

    # For location, source, and general queries - use generate_insight with context
    enriched_message = req.message
    if req.risk_context:
        try:
            ctx = _json.loads(req.risk_context)
            enriched_message = (
                f"{req.message}\n\n"
                f"[Frontend risk context for {req.location_name or 'selected location'}:\n"
                f"Overall: {ctx.get('overall', {}).get('score')}/100 "
                f"({ctx.get('overall', {}).get('level')})\n"
                f"Main drivers: {', '.join(ctx.get('main_drivers') or [])}\n"
                f"Confidence: {ctx.get('confidence')}\n"
                f"Data coverage: {ctx.get('data_coverage')}]"
            )
        except (ValueError, TypeError):
            pass

    result = await generate_insight("agent", risk, enriched_message, req.persona, req.provider, req.mapTargetContext)
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


@app.post("/api/generate-insights")
async def generate_insights_endpoint(
    lat: float = Query(..., ge=-90, le=90),
    lng: float = Query(..., ge=-180, le=180),
    name: str = Query(None, max_length=120),
    hazard_layer: str = Query("overall", max_length=32),
    persona: str = Query("citizen", max_length=32),
):
    """Generate grounded risk intelligence insights for a location.

    Insights are strictly grounded in:
    - Approved disaster source registry
    - Deterministic risk scores
    - Official datasets
    - User's selected hazard layer and persona

    All sources are cited. Unsupported claims are blocked.
    """
    risk = score_location(lat, lng, name)
    providers = build_providers()
    insight = await generate_insights(
        risk_data=risk,
        hazard_layer=hazard_layer,
        persona=persona,
        providers=providers,
        location_name=name or f"{lat}, {lng}",
    )
    return {"risk": risk, "insight": insight.to_dict()}


# ---------------------------------------------------------------- data sync & status
_last_sync_timestamp = None
_sync_status = {}


@app.get("/api/data-status")
def data_status():
    """Report current data freshness and sync status.

    Returns whether displayed data is real-time, synced, stale, or static/mock.
    """
    global _last_sync_timestamp, _sync_status

    # MVP: using static sample data, not real-time APIs
    is_fresh = _last_sync_timestamp is not None
    return DataStatusResponse(
        data_type="static",  # MVP uses sample_hazards.py
        last_sync_timestamp=_last_sync_timestamp,
        sources_status=_sync_status or {"sample-data": "manual"},
        sync_method="static-file",
        is_fresh=is_fresh,
        message="MVP uses curated sample data. To enable real-time sync, configure source APIs (PAGASA, PHIVOLCS, NASA FIRMS, etc.).",
    )


@app.post("/api/data-sync")
def data_sync(request: Request):
    """Manually trigger data sync from approved official sources.

    In production, this would fetch from:
    - PHIVOLCS Latest Earthquake Information
    - PAGASA Severe Weather Bulletin
    - NASA FIRMS Active Fire Data
    - USGS Earthquake GeoJSON
    - And other approved sources

    For MVP: returns status message.
    """
    global _last_sync_timestamp, _sync_status
    require_permission(request, "manage_datasets")

    _last_sync_timestamp = datetime.now(timezone.utc).isoformat()
    _sync_status = {
        "sample-data": "synced",
        "phivolcs": "pending (api-key required)",
        "pagasa": "pending (api-key required)",
        "nasa-firms": "pending (api-key required)",
    }

    return {
        "message": "Data sync triggered (MVP: sample data only)",
        "sync_timestamp": _last_sync_timestamp,
        "status": _sync_status,
        "sources_available": [
            "PHIVOLCS Latest Earthquake Information",
            "PAGASA Severe Weather Bulletin",
            "NASA FIRMS Active Fire Data",
            "USGS Earthquake GeoJSON",
        ],
        "next_steps": "Configure source API keys in environment variables to enable live data.",
    }


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


# ---------------------------------------------------------------- source registry & sync health
@app.get("/api/source-registry")
def source_registry_endpoint():
    """Return the global approved source registry."""
    from .data_sources.registry.sources_registry import get_registry_summary
    return {"sources": get_registry_summary()}


@app.get("/api/sync-health")
def sync_health_endpoint():
    """Return sync health status for all registered sources."""
    from .data_sources.sync.source_sync_health import get_sync_health_report
    return {"sync_health": get_sync_health_report()}


@app.get("/api/sync-audit-log")
def sync_audit_log_endpoint(source_id: str = Query(None), limit: int = Query(50, le=200)):
    """Return the sync audit log."""
    from .data_sources.sync.sync_audit_log import get_audit_log
    return {"audit_log": get_audit_log(source_id=source_id, limit=limit)}


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
