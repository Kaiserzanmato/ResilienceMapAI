"""CSV and PDF export generation, plus the in-memory shareable report store.

The report store keeps generated reports addressable by id for share links;
swap for PostgreSQL persistence in production (models are schema-ready).
"""
import base64
import csv
import io
import secrets
from datetime import datetime, timezone
from typing import Dict, List, Optional

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.platypus import (HRFlowable, Image, Paragraph, SimpleDocTemplate,
                                Spacer, Table, TableStyle)

from ..data.sample_hazards import HAZARD_KEYS
from .ai_router import DISCLAIMER, grounding_sources

CSV_COLUMNS = [
    "location_name", "latitude", "longitude", "overall_score", "overall_level",
    "flood_score", "earthquake_score", "tropical_cyclone_score", "volcano_score",
    "landslide_score", "storm_surge_score", "main_drivers", "source_names",
    "source_dates", "generated_at",
]

RISK_COLOR_HEX = {"green": "#22c55e", "yellow": "#eab308", "red": "#ef4444",
                  "gray": "#9ca3af"}

PERSONA_REPORT_TITLES = {
    "citizen": "Citizen Risk Summary",
    "real_estate": "Real Estate Due Diligence Brief",
    "insurance": "Insurance / Fintech Risk Memo",
    "government": "Government Planning Brief",
    "ngo": "NGO Priority Brief",
    "business": "Business Continuity Brief",
    "school": "School Safety Brief",
    "executive": "Executive Summary",
}

# In-memory shareable report registry: id -> report payload
_REPORT_STORE: Dict[str, Dict] = {}


def store_report(payload: Dict) -> str:
    report_id = secrets.token_urlsafe(8)
    payload["id"] = report_id
    payload["created_at"] = datetime.now(timezone.utc).isoformat()
    _REPORT_STORE[report_id] = payload
    return report_id


def get_report(report_id: str) -> Optional[Dict]:
    return _REPORT_STORE.get(report_id)


def list_reports() -> List[Dict]:
    return sorted(_REPORT_STORE.values(), key=lambda r: r["created_at"], reverse=True)


def risks_to_csv(risks: List[Dict]) -> str:
    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=CSV_COLUMNS)
    writer.writeheader()
    sources = grounding_sources()
    for r in risks:
        row = {
            "location_name": r["location_name"],
            "latitude": r["latitude"],
            "longitude": r["longitude"],
            "overall_score": r["overall"]["score"],
            "overall_level": r["overall"]["level"],
            "main_drivers": "; ".join(r.get("main_drivers", [])),
            "source_names": "; ".join(s["name"] for s in sources),
            "source_dates": "; ".join(s["updated"] for s in sources),
            "generated_at": r["generated_at"],
        }
        for key in HAZARD_KEYS:
            row[f"{key}_score"] = r["hazards"][key]["score"]
        writer.writerow(row)
    return buf.getvalue()


def _styles():
    base = getSampleStyleSheet()
    return {
        "title": ParagraphStyle("rm-title", parent=base["Title"], fontSize=22,
                                spaceAfter=4, textColor=colors.HexColor("#0f172a")),
        "subtitle": ParagraphStyle("rm-sub", parent=base["Normal"], fontSize=10.5,
                                   textColor=colors.HexColor("#475569"), spaceAfter=14),
        "h2": ParagraphStyle("rm-h2", parent=base["Heading2"], fontSize=13,
                             spaceBefore=14, spaceAfter=6,
                             textColor=colors.HexColor("#0f172a")),
        "body": ParagraphStyle("rm-body", parent=base["Normal"], fontSize=10,
                               leading=14.5, textColor=colors.HexColor("#1e293b")),
        "small": ParagraphStyle("rm-small", parent=base["Normal"], fontSize=8.5,
                                leading=11.5, textColor=colors.HexColor("#64748b")),
    }


def build_pdf_report(risk: Dict, persona: str, ai_summary: str,
                     recommendations: Optional[List[str]] = None,
                     map_image: Optional[str] = None) -> bytes:
    """Render a persona-specific PDF risk report."""
    st = _styles()
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, topMargin=18 * mm, bottomMargin=16 * mm,
                            leftMargin=18 * mm, rightMargin=18 * mm,
                            title=f"ResilienceMap AI — {risk['location_name']}")
    story = []
    report_title = PERSONA_REPORT_TITLES.get(persona, "Risk Intelligence Report")
    story.append(Paragraph("ResilienceMap AI", st["small"]))
    story.append(Paragraph(report_title, st["title"]))
    story.append(Paragraph(
        f"{risk['location_name']} · {risk['latitude']:.4f}, {risk['longitude']:.4f} · "
        f"Generated {datetime.now(timezone.utc).strftime('%B %d, %Y %H:%M UTC')} · "
        f"Persona: {persona.replace('_', ' ').title()}", st["subtitle"]))
    story.append(HRFlowable(width="100%", color=colors.HexColor("#e2e8f0")))

    # Overall score banner
    o = risk["overall"]
    score_txt = "No Data" if o["score"] is None else f"{o['score']} / 100 — {o['level']} Risk"
    banner = Table([[Paragraph(f"<b>Overall Risk Score</b><br/>{score_txt}", st["body"]),
                     Paragraph(f"<b>Engine Confidence</b><br/>{risk['confidence']}", st["body"]),
                     Paragraph(f"<b>Data Coverage</b><br/>{risk['data_coverage'].title()}",
                               st["body"])]],
                   colWidths=[doc.width / 3] * 3)
    banner.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f1f5f9")),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
        ("TOPPADDING", (0, 0), (-1, -1), 8), ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
    ]))
    story += [Spacer(1, 10), banner]

    # Map snapshot (client-captured, optional)
    if map_image:
        try:
            raw = base64.b64decode(map_image.split(",", 1)[1])
            reader = ImageReader(io.BytesIO(raw))
            iw, ih = reader.getSize()
            width = doc.width
            height = min(width * ih / iw, 90 * mm)
            story.append(Paragraph("Map Snapshot", st["h2"]))
            story.append(Image(io.BytesIO(raw), width=width, height=height))
        except Exception:
            pass  # never fail report generation over a bad snapshot

    # Hazard breakdown table
    story.append(Paragraph("Hazard Breakdown", st["h2"]))
    rows = [["Hazard", "Score", "Level"]]
    row_colors = []
    for h in risk["hazards"].values():
        score = "—" if h["score"] is None else str(h["score"])
        rows.append([h["label"], score, h["level"]])
        row_colors.append(colors.HexColor(RISK_COLOR_HEX[h["color"]]))
    tbl = Table(rows, colWidths=[doc.width * 0.5, doc.width * 0.2, doc.width * 0.3])
    style = [
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0f172a")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTSIZE", (0, 0), (-1, -1), 9.5),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
        ("TOPPADDING", (0, 0), (-1, -1), 6), ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
    ]
    for i, c in enumerate(row_colors, start=1):
        style.append(("TEXTCOLOR", (2, i), (2, i), c))
        style.append(("FONTNAME", (2, i), (2, i), "Helvetica-Bold"))
    tbl.setStyle(TableStyle(style))
    story.append(tbl)
    story.append(Paragraph(
        "Risk legend: 0–25 Low (green) · 26–60 Medium (yellow) · 61–100 High (red) · "
        "No data (gray)", st["small"]))

    if risk.get("main_drivers"):
        story.append(Paragraph("Main Risk Drivers", st["h2"]))
        story.append(Paragraph(", ".join(risk["main_drivers"]), st["body"]))

    nz = risk.get("nearest_zone")
    if nz:
        story.append(Paragraph("Exposure Snapshot", st["h2"]))
        story.append(Paragraph(
            f"Nearest profiled area: <b>{nz['name']}, {nz['country']}</b> — population "
            f"{nz['population']:,}; {nz['critical_facilities']} critical facilities; "
            f"{nz['schools']} schools; {nz['hospitals']} hospitals.", st["body"]))

    story.append(Paragraph("AI-Generated Summary", st["h2"]))
    for para in (ai_summary or "").split("\n"):
        if para.strip():
            clean = para.replace("**", "").replace("_", "")
            prefix = "• " if para.strip().startswith(("-", "•")) else ""
            story.append(Paragraph(prefix + clean.lstrip("-• "), st["body"]))

    if recommendations:
        story.append(Paragraph("Recommended Actions", st["h2"]))
        for rec in recommendations:
            story.append(Paragraph(f"• {rec}", st["body"]))

    story.append(Paragraph("Source Metadata", st["h2"]))
    for s in grounding_sources():
        story.append(Paragraph(
            f"• <b>{s['name']}</b> — {s['agency']} · updated {s['updated']} · "
            f"{s['confidence']} confidence", st["small"]))

    story += [Spacer(1, 14), HRFlowable(width="100%", color=colors.HexColor("#e2e8f0")),
              Spacer(1, 6), Paragraph(f"Disclaimer: {DISCLAIMER}", st["small"]),
              Paragraph(f"Methodology: {risk['methodology']}", st["small"])]

    doc.build(story)
    return buf.getvalue()
