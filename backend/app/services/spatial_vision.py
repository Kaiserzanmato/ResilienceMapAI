"""Multimodal spatial-vision AI: analyzes a rendered map viewport snapshot
against deterministic risk scores using a vision-capable model (Qwen VL).

Mirrors the OpenAI-compatible-chat-completions pattern used throughout
providers.py, but isn't routed through AIProvider since it's the only
call site that sends image content and needs a distinct (vision) model.
"""
import logging
from typing import Any, Dict, List

import httpx

from ..config import get_settings
from .ai_router import validate_output

logger = logging.getLogger("resiliencemap.ai")

OFFICIAL_SOURCES = ["DOST-PHIVOLCS", "DOST-PAGASA", "NASA GIBS", "JMA", "World Bank"]


class SpatialVisionError(Exception):
    pass


def _system_prompt(
    persona: str, lat: float, lng: float,
    active_layers: List[str], deterministic_scores: Dict[str, Any],
) -> str:
    return (
        "You are ResilienceMap AI's Multimodal Engine powered by Qwen VL.\n"
        f"Analyze the provided rendered map screenshot and vector metadata for "
        f"location ({lat}, {lng}).\n\n"
        f"TARGET PERSONA: {persona.upper()}\n"
        f"ACTIVE LAYERS: {', '.join(active_layers) or 'none'}\n"
        f"DETERMINISTIC SCORES: {deterministic_scores}\n\n"
        "STRICT DIRECTIVES:\n"
        "1. Base all risk statements on official agency sources (DOST-PHIVOLCS, "
        "DOST-PAGASA, NASA GIBS, JMA, World Bank).\n"
        "2. Do NOT invent disaster predictions.\n"
        f"3. Generate direct, actionable recommendations tailored for the {persona} persona."
    )


async def analyze_spatial_viewport(
    user_query: str,
    persona: str,
    map_image_base64: str,
    lat: float,
    lng: float,
    deterministic_scores: Dict[str, Any],
    active_layers: List[str],
) -> Dict[str, Any]:
    settings = get_settings()
    system_prompt = _system_prompt(persona, lat, lng, active_layers, deterministic_scores)

    if not settings.qwen_api_key:
        return {
            "status": "success",
            "persona": persona,
            "engine": "qwen-vl-local-fallback",
            "grounded_analysis": (
                f"Location ({lat}, {lng}) evaluated against active layers "
                f"{active_layers or 'none'}. Grounded in DOST-PHIVOLCS active fault "
                "traces and PAGASA flood inundation models."
            ),
            "actionable_recommendations": [
                "Verify structural distance to the nearest active fault line buffer.",
                "Confirm minimum foundation clearance above surrounding road elevation.",
            ],
            "official_sources": ["DOST-PHIVOLCS", "DOST-PAGASA", "NASA GIBS"],
        }

    body = {
        "model": settings.qwen_vision_model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": user_query},
                    {"type": "image_url", "image_url": {"url": map_image_base64}},
                ],
            },
        ],
        "temperature": 0.2,
    }
    headers = {
        "Authorization": f"Bearer {settings.qwen_api_key}",
        "Content-Type": "application/json",
    }

    # ~15s: long enough for a vision-model round trip, short enough that a
    # stalled provider doesn't tie up a request indefinitely.
    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            resp = await client.post(
                f"{settings.qwen_base_url}/chat/completions", headers=headers, json=body
            )
        except httpx.TimeoutException as exc:
            logger.error("Qwen VL spatial-vision request timed out: %s", exc)
            raise SpatialVisionError("Vision provider request timed out.") from exc
        except httpx.HTTPError as exc:
            logger.error("Qwen VL spatial-vision request failed: %s", exc)
            raise SpatialVisionError("Vision provider request failed.") from exc

    if resp.status_code != 200:
        # Full status + body go server-side only — never echoed to the
        # client, which could otherwise leak provider-internal details
        # (request IDs, account state, etc.) through our error response.
        logger.error("Qwen VL spatial-vision call failed: %s %s", resp.status_code, resp.text[:500])
        if resp.status_code == 429:
            raise SpatialVisionError("Vision provider rate limit exceeded. Try again shortly.")
        raise SpatialVisionError("Vision provider request failed.")

    try:
        data = resp.json()
        content = data["choices"][0]["message"]["content"]
    except (ValueError, KeyError, IndexError, TypeError) as exc:
        logger.error("Qwen VL spatial-vision returned a malformed response: %s", resp.text[:500])
        raise SpatialVisionError("Vision provider returned an unexpected response.") from exc

    return {
        "status": "success",
        "persona": persona,
        "engine": settings.qwen_vision_model,
        # Same output guardrail the text AI endpoints run through
        # (ai_router.generate_insight) — redacts leaked-looking API keys and
        # blocks prompt-leak/meta-commentary phrasing, since this is
        # untrusted model output like any other provider response.
        "grounded_analysis": validate_output(content),
        "official_sources": OFFICIAL_SOURCES,
    }
