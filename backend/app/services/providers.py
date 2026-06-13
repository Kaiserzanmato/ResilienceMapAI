"""AI provider abstraction.

All providers expose `generate(messages) -> str`. Qwen, DeepSeek, MiMo and
OpenAI speak the OpenAI-compatible chat completions protocol; Gemini uses its
native REST API. When no API key is configured the LocalInsightProvider
produces deterministic, template-based insights grounded entirely in the
scored risk data — it cannot hallucinate because it only restates engine
output.

All calls happen server-side; keys never reach the browser.
"""
import logging
from typing import Dict, List, Optional

import httpx

from ..config import get_settings

logger = logging.getLogger("resiliencemap.ai")

Message = Dict[str, str]  # {"role": ..., "content": ...}


class ProviderError(Exception):
    pass


class AIProvider:
    name = "base"

    def available(self) -> bool:
        raise NotImplementedError

    async def generate(self, messages: List[Message], max_tokens: int = 900) -> str:
        raise NotImplementedError


class OpenAICompatibleProvider(AIProvider):
    """Shared implementation for Qwen (DashScope), DeepSeek, MiMo, OpenAI."""

    def __init__(self, name: str, api_key: str, base_url: str, model: str):
        self.name = name
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self.model = model

    def available(self) -> bool:
        return bool(self.api_key)

    async def generate(self, messages: List[Message], max_tokens: int = 900) -> str:
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(
                f"{self.base_url}/chat/completions",
                headers={"Authorization": f"Bearer {self.api_key}"},
                json={"model": self.model, "messages": messages,
                      "max_tokens": max_tokens, "temperature": 0.3},
            )
        if resp.status_code != 200:
            raise ProviderError(f"{self.name} returned {resp.status_code}: {resp.text[:200]}")
        data = resp.json()
        try:
            return data["choices"][0]["message"]["content"]
        except (KeyError, IndexError) as e:
            raise ProviderError(f"{self.name} unexpected response shape") from e


class GeminiProvider(AIProvider):
    name = "gemini"

    def __init__(self, api_key: str, model: str):
        self.api_key = api_key
        self.model = model

    def available(self) -> bool:
        return bool(self.api_key)

    async def generate(self, messages: List[Message], max_tokens: int = 900) -> str:
        system = "\n".join(m["content"] for m in messages if m["role"] == "system")
        contents = [
            {"role": "user" if m["role"] == "user" else "model",
             "parts": [{"text": m["content"]}]}
            for m in messages if m["role"] != "system"
        ]
        body = {"contents": contents,
                "generationConfig": {"maxOutputTokens": max_tokens, "temperature": 0.3}}
        if system:
            body["systemInstruction"] = {"parts": [{"text": system}]}
        url = (f"https://generativelanguage.googleapis.com/v1beta/models/"
               f"{self.model}:generateContent?key={self.api_key}")
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(url, json=body)
        if resp.status_code != 200:
            raise ProviderError(f"gemini returned {resp.status_code}")
        try:
            return resp.json()["candidates"][0]["content"]["parts"][0]["text"]
        except (KeyError, IndexError) as e:
            raise ProviderError("gemini unexpected response shape") from e


class LocalInsightProvider(AIProvider):
    """Deterministic fallback. Grounded exclusively in the risk payload passed
    via the structured context — restates engine output, never invents data."""

    name = "local-insight"

    def available(self) -> bool:
        return True

    async def generate(self, messages: List[Message], max_tokens: int = 900) -> str:
        # The router attaches the structured risk context; the local provider
        # only formats it (see ai_router.local_insight for the actual logic).
        # Generic path for free-form questions:
        last_user = next((m["content"] for m in reversed(messages) if m["role"] == "user"), "")
        return (
            "I can help you interpret the calculated risk data shown on the map and "
            "dashboard. Select a location to get a grounded summary of its hazard "
            "scores, main risk drivers, and persona-specific recommendations.\n\n"
            "Note: no external AI provider is configured, so I am running in "
            "deterministic local mode — responses are generated directly from the "
            "scored dataset without a language model.\n\n"
            f"Your question: \"{last_user[:300]}\""
        )


def build_providers() -> Dict[str, AIProvider]:
    s = get_settings()
    return {
        "qwen": OpenAICompatibleProvider("qwen", s.qwen_api_key, s.qwen_base_url, s.qwen_model),
        "deepseek": OpenAICompatibleProvider("deepseek", s.deepseek_api_key,
                                             s.deepseek_base_url, s.deepseek_model),
        "mimo": OpenAICompatibleProvider("mimo", s.mimo_api_key, s.mimo_base_url, s.mimo_model),
        "openai": OpenAICompatibleProvider("openai", s.openai_api_key,
                                           s.openai_base_url, s.openai_model),
        "gemini": GeminiProvider(s.gemini_api_key, s.gemini_model),
        "local": LocalInsightProvider(),
    }


def pick_provider(task: str, providers: Dict[str, AIProvider],
                  preferred: Optional[str] = None) -> AIProvider:
    """Route by task per the build plan: Qwen for summaries/reports/personas,
    DeepSeek for structured reasoning, MiMo for agentic workflows. Falls back
    through the chain to the always-available local provider."""
    if preferred and preferred in providers and providers[preferred].available():
        return providers[preferred]
    routing = {
        "summary": ["qwen", "deepseek", "openai", "gemini"],
        "report": ["qwen", "deepseek", "openai", "gemini"],
        "agent": ["mimo", "deepseek", "qwen", "openai", "gemini"],
        "reasoning": ["deepseek", "qwen", "openai", "gemini"],
    }
    for name in routing.get(task, ["qwen", "deepseek", "mimo", "openai", "gemini"]):
        if providers[name].available():
            return providers[name]
    return providers["local"]
