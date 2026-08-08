"""ResilienceMap AI — FastAPI backend.

All AI calls are server-side; risk scoring is deterministic; every /api route
is rate-limited and audit-logged.
"""
from datetime import datetime, timezone

from fastapi import FastAPI, HTTPException, Query, Request, Response
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .data.sample_hazards import ACTIVE_ALERTS, DATASETS, HAZARD_EVENTS
from .data_sources.sync.run_source_sync import run_all_wired_sources
from .repositories.dataset_repo import get_dataset_repo
from .schemas import (AgentQueryRequest, AIReportRequest, AISummaryRequest,
                      AskAIRequest, CompareRequest, DatasetUpload, DataStatusResponse,
                      ExportCSVRequest, ExportPDFRequest, ShareLinkRequest,
                      SpatialVisionRequest, GlobalAssessmentRequest)
from .security import AuditLogMiddleware, RateLimitMiddleware, require_permission
from .services import geospatial_query as geo
from .services.ask_ai import ask_ai_guardrailed
from .services.dashboard import dashboard_stats
from .services.insights_generator import generate_insights
from .services.ai_router import DISCLAIMER, generate_insight
from .services.exporters import (build_pdf_report, get_report, list_reports,
                                 risks_to_csv, store_report)
from .services.risk_scoring import compare_locations, score_location
from .services.global_assessment import assess_location
from .services.providers import build_providers, pick_provider
from .services import usage_quota

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

@app.get("/health")
def health():
    return {"status": "ok", "service": settings.app_name, "version": settings.version,
            "time": datetime.now(timezone.utc).isoformat()}


PROVIDER_DISPLAY_NAMES = {
    "qwen": "Qwen", "deepseek": "DeepSeek", "together": "Together AI",
    "mimo": "MiMo", "openai": "OpenAI", "gemini": "Gemini",
    "local-insight": "Local (Deterministic)",
}


@app.get("/api/ai-provider-info")
def ai_provider_info():
    """Return whichever AI provider/model will actually answer requests right
    now, not a hardcoded default — so this stays correct as providers are
    added, removed, or reordered in providers.pick_provider. Resolved using
    the "agent" task specifically because that's what the AI Workspace chat
    (the primary consumer of this endpoint) actually calls in /api/agent/query
    — its routing chain includes "mimo", which other task chains omit, so
    resolving against any other task could report a stale provider."""
    provider = pick_provider("agent", build_providers())
    display = PROVIDER_DISPLAY_NAMES.get(provider.name, provider.name.title())
    model = getattr(provider, "model", None)
    return {
        "provider": provider.name,
        "model": model or provider.name,
        "provider_display": display,
        "model_display": f"{display} {model}" if model else display,
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
async def geocode(q: str = Query(..., min_length=1, max_length=80)):
    return await geo.search_locations_global(q)


@app.post("/api/assessments")
def global_assessment(req: GlobalAssessmentRequest):
    """Registry-routed, evidence-aware multi-hazard screening contract."""
    return assess_location(req.lat, req.lng, req.name, req.country_code, req.geometry_type)


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


@app.post("/api/ai/spatial-vision")
async def ai_spatial_vision(req: SpatialVisionRequest):
    """Multimodal viewport analysis ("Analyze with AI"). Disabled — the
    qwen3-vl-flash vision model this endpoint depended on was turned off."""
    raise HTTPException(status_code=404, detail="Spatial-vision analysis is currently disabled.")


@app.post("/api/agent/query")
async def agent_query(req: AgentQueryRequest, request: Request):
    usage_quota.consume("chat", usage_quota.client_key(request))
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
async def ask_ai(req: AskAIRequest, request: Request):
    """Ask AI with disaster intelligence guardrails.

    Enforces scope checking (disaster/hazard/resilience only), source attribution,
    and approved source usage. Returns grounded answers with citations or scope
    refusal message if query is unrelated to disasters/hazards.
    """
    usage_quota.consume("chat", usage_quota.client_key(request))
    result = await ask_ai_guardrailed(
        query=req.query,
        lat=req.lat,
        lng=req.lng,
        location_name=req.location_name,
        persona=req.persona,
        provider=req.provider,
        map_target_context=req.mapTargetContext,
    )
    return result


@app.post("/api/generate-insights")
async def generate_insights_endpoint(
    request: Request,
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
    usage_quota.consume("insights", usage_quota.client_key(request))
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


@app.get("/api/usage-status")
async def usage_status(request: Request):
    """Read-only usage-quota status for the calling client — does not
    consume a hit. Drives the usage meters shown in the UI (Insights,
    AI Agent panel, AI Workspace)."""
    key = usage_quota.client_key(request)
    return {
        "insights": usage_quota.get_status("insights", key).to_dict(),
        "chat": usage_quota.get_status("chat", key).to_dict(),
    }


# ---------------------------------------------------------------- data sync & status
@app.get("/api/data-status")
async def data_status():
    """Report current data freshness and sync status, derived from real sync
    health (see app/data_sources/sync/) rather than a hardcoded MVP status."""
    from .data_sources.sync.run_source_sync import WIRED_SOURCE_IDS
    from .data_sources.sync.source_sync_health import get_sync_health_report

    health = await get_sync_health_report()
    wired = [h for h in health if h["source_id"] in WIRED_SOURCE_IDS]
    synced = [h for h in wired if h["last_sync_status"] == "success"]

    last_sync_timestamp = None
    successful_ats = [h["last_successful_sync_at"] for h in wired if h["last_successful_sync_at"]]
    if successful_ats:
        last_sync_timestamp = max(successful_ats)

    is_fresh = bool(synced) and not any(h["is_stale"] for h in synced)
    sources_status = {h["source_id"]: (h["last_sync_status"] or "never") for h in wired}

    if synced:
        data_type, message = "synced", "Live sources synced via scheduled backend sync."
    else:
        data_type, message = (
            "static",
            "No wired source has completed a sync yet. Falling back to curated sample data "
            "(sample_hazards.py) until the first successful sync.",
        )

    return DataStatusResponse(
        data_type=data_type,
        last_sync_timestamp=last_sync_timestamp,
        sources_status=sources_status or {"sample-data": "manual"},
        sync_method="scheduled" if wired else "static-file",
        is_fresh=is_fresh,
        message=message,
    )


@app.post("/api/data-sync")
async def data_sync(request: Request):
    """Manually trigger data sync for stale/eligible wired sources. Shares
    dispatch logic with the Vercel Cron-triggered endpoint below, so a manual
    admin trigger and the scheduled one never diverge in behavior."""
    require_permission(request, "manage_datasets")
    result = await run_all_wired_sources()
    return {
        "message": f"Sync triggered for {len(result['sources_synced'])} wired source(s).",
        **result,
    }


@app.get("/api/cron/sync-sources")
async def cron_sync_sources(request: Request):
    """Vercel Cron target — see the `crons` entry in vercel.json. Guarded by a
    shared secret rather than RBAC, since Vercel's scheduler can't supply an
    X-Role header. Not exposed to, or callable by, ordinary users."""
    expected = f"Bearer {settings.cron_secret}"
    if not settings.cron_secret or request.headers.get("authorization") != expected:
        raise HTTPException(403, "Forbidden")
    return await run_all_wired_sources()


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
    report_id = await store_report({"risk": risk, "summary": summary["answer"],
                                    "persona": req.persona, "sources": summary["sources"],
                                    "disclaimer": DISCLAIMER})
    return {"report_id": report_id, "path": f"/reports/shared/{report_id}"}


# ---------------------------------------------------------------- reports
@app.get("/api/reports")
async def reports_index():
    return {"reports": [
        {"id": r["id"], "location": r["risk"]["location_name"],
         "persona": r["persona"], "created_at": r["created_at"],
         "overall": r["risk"]["overall"]}
        for r in await list_reports()
    ]}


@app.get("/api/reports/{report_id}")
async def report_detail(report_id: str):
    report = await get_report(report_id)
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
async def sync_health_endpoint():
    """Return sync health status for all registered sources."""
    from .data_sources.sync.source_sync_health import get_sync_health_report
    return {"sync_health": await get_sync_health_report()}


@app.get("/api/sync-audit-log")
async def sync_audit_log_endpoint(source_id: str = Query(None), limit: int = Query(50, le=200)):
    """Return the sync audit log."""
    from .data_sources.sync.sync_audit_log import get_audit_log
    return {"audit_log": await get_audit_log(source_id=source_id, limit=limit)}


# ---------------------------------------------------------------- datasets
@app.get("/api/datasets")
async def datasets():
    uploaded = await get_dataset_repo().list()
    return {"datasets": DATASETS + uploaded}


@app.post("/api/datasets/upload")
async def upload_dataset(meta: DatasetUpload, request: Request):
    require_permission(request, "manage_datasets")
    entry = await get_dataset_repo().add(meta.model_dump())
    return {"dataset": entry, "message": "Dataset metadata registered for review."}
