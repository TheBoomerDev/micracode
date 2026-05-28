"""Catalog of provider/model pairs the API will accept at runtime.

Supports dynamic fetching from provider APIs when API keys are provided,
falling back to a hardcoded catalog otherwise.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import httpx

from .config import CoreConfig

ProviderId = str


@dataclass(frozen=True)
class _Model:
    id: str
    label: str
    family: str


@dataclass(frozen=True)
class _Provider:
    id: str
    label: str
    models: tuple[_Model, ...]


# --- Hardcoded fallback catalog ---
_PROVIDERS: tuple[_Provider, ...] = (
    _Provider(
        id="openai",
        label="OpenAI",
        models=(
            _Model(id="gpt-4o", label="GPT-4o", family="openai-chat"),
            _Model(id="gpt-4o-mini", label="GPT-4o Mini", family="openai-chat"),
            _Model(id="o3-mini", label="o3-mini (Reasoning)", family="openai-reasoning"),
            _Model(id="o1", label="o1 (Reasoning)", family="openai-reasoning"),
        ),
    ),
    _Provider(
        id="gemini",
        label="Google Gemini",
        models=(
            _Model(id="gemini-3.5-flash", label="Gemini 3.5 Flash (latest)", family="gemini"),
            _Model(id="gemini-3.1-flash-lite", label="Gemini 3.1 Flash Lite", family="gemini"),
            _Model(id="gemini-2.5-flash", label="Gemini 2.5 Flash", family="gemini"),
            _Model(id="gemini-2.5-pro", label="Gemini 2.5 Pro", family="gemini"),
            _Model(id="gemini-embedding-2", label="Gemini Embedding 2", family="gemini"),
        ),
    ),
    _Provider(
        id="openrouter",
        label="OpenRouter",
        models=(
            _Model(id="openai/gpt-4o", label="GPT-4o (OpenRouter)", family="openai-chat"),
            _Model(id="anthropic/claude-sonnet-4", label="Claude Sonnet 4", family="anthropic"),
            _Model(id="google/gemini-2.5-flash", label="Gemini 2.5 Flash (OR)", family="gemini"),
            _Model(id="meta-llama/llama-4", label="Llama 4", family="meta"),
            _Model(id="deepseek/deepseek-chat", label="DeepSeek Chat", family="deepseek"),
        ),
    ),
    _Provider(
        id="deepseek",
        label="DeepSeek",
        models=(
            _Model(id="deepseek-chat", label="DeepSeek V3 (Chat)", family="deepseek"),
            _Model(id="deepseek-reasoner", label="DeepSeek R1 (Reasoner)", family="deepseek"),
        ),
    ),
    _Provider(
        id="glm",
        label="GLM (Zhipu AI)",
        models=(
            _Model(id="glm-4-plus", label="GLM-4 Plus", family="glm"),
            _Model(id="glm-4-air", label="GLM-4 Air", family="glm"),
            _Model(id="glm-4-flash", label="GLM-4 Flash", family="glm"),
        ),
    ),
)


def _provider(pid: str) -> _Provider | None:
    for p in _PROVIDERS:
        if p.id == pid:
            return p
    return None


def _has_model(provider: _Provider, model_id: str) -> bool:
    return any(m.id == model_id for m in provider.models)


# --- Dynamic fetch functions ---

async def _fetch_openai_models(api_key: str) -> list[dict[str, str]]:
    """Fetch models from OpenAI API: https://platform.openai.com/docs/api-reference/models/list"""
    if not api_key:
        return []
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                "https://api.openai.com/v1/models",
                headers={"Authorization": f"Bearer {api_key}"},
            )
            resp.raise_for_status()
            data = resp.json()
            return [
                {"id": m["id"], "label": m["id"]}
                for m in data.get("data", [])
                if m.get("id", "").startswith(("gpt-", "o1", "o3", "o4"))
            ]
    except Exception:
        return []


async def _fetch_gemini_models(api_key: str) -> list[dict[str, str]]:
    """Fetch models from Gemini API: https://ai.google.dev/api/models"""
    if not api_key:
        return []
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                f"https://generativelanguage.googleapis.com/v1/models?key={api_key}"
            )
            if resp.status_code == 200:
                data = resp.json()
                # Filter to relevant models: gemini-2.5+, gemini-3.x, gemma-4, embeddings
                # Exclude: gemini-2.0*, gemini-2.5-flash-image (niche)
                RELEVANT_PREFIXES = (
                    "models/gemini-3.",   # latest gen (3.1, 3.5)
                    "models/gemini-2.5",  # current gen
                    "models/gemma-4",     # open model
                    "models/gemini-embedding",
                )
                return [
                    {"id": m["name"].split("/")[-1], "label": m["name"].split("/")[-1]}
                    for m in data.get("models", [])
                    if m.get("name", "").startswith(RELEVANT_PREFIXES)
                    and "flash-image" not in m.get("name", "")
                ]
            return []
    except Exception:
        return []


async def _fetch_ollama_models(base_url: str) -> list[dict[str, str]]:
    """Fetch models from local Ollama instance."""
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            resp = await client.get(f"{base_url}/api/tags")
            resp.raise_for_status()
            data = resp.json()
            return [{"id": m["name"], "label": m["name"]} for m in data.get("models", [])]
    except Exception:
        return []


async def _fetch_openrouter_models(api_key: str) -> list[dict[str, str]]:
    """Fetch models from OpenRouter API: https://openrouter.ai/docs/api/api-reference/models/get-models"""
    if not api_key:
        return []
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                "https://openrouter.ai/api/v1/models",
                headers={"Authorization": f"Bearer {api_key}"},
            )
            if resp.status_code == 200:
                data = resp.json()
                return [
                    {"id": m["id"], "label": m.get("name", m["id"])}
                    for m in data.get("data", [])
                ]
            return []
    except Exception:
        return []


async def _fetch_deepseek_models(api_key: str) -> list[dict[str, str]]:
    """Fetch models from DeepSeek API: https://api-docs.deepseek.com/api/list-models"""
    if not api_key:
        return []
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                "https://api.deepseek.com/models",
                headers={"Authorization": f"Bearer {api_key}"},
            )
            if resp.status_code == 200:
                data = resp.json()
                return [
                    {"id": m["id"], "label": m.get("id", "")}
                    for m in data.get("data", [])
                ]
            return []
    except Exception:
        return []


async def _fetch_glm_models(api_key: str) -> list[dict[str, str]]:
    """Fetch models from Zhipu AI (GLM) API."""
    if not api_key:
        return []
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                "https://open.bigmodel.cn/api/paas/v4/models",
                headers={"Authorization": f"Bearer {api_key}"},
            )
            if resp.status_code == 200:
                data = resp.json()
                return [
                    {"id": m["id"], "label": m.get("name", m["id"])}
                    for m in data.get("data", [])
                ]
            return []
    except Exception:
        return []


# --- Provider fetch registry ---
_FETCH_REGISTRY: dict[str, tuple[str, Any]] = {
    "openai": ("openai_api_key", _fetch_openai_models),
    "gemini": ("google_api_key", _fetch_gemini_models),
    "openrouter": ("openrouter_api_key", _fetch_openrouter_models),
    "deepseek": ("deepseek_api_key", _fetch_deepseek_models),
    "glm": ("glm_api_key", _fetch_glm_models),
    "ollama": ("ollama_base_url", _fetch_ollama_models),
}

# Hardcoded fallback for known providers
_HARDCODED_IDS = {p.id for p in _PROVIDERS}


async def list_catalog(
    config: CoreConfig,
    override_keys: dict[str, str] | None = None,
) -> dict:
    """Serialise the registry for the public ``GET /v1/models`` endpoint.

    Uses override_keys (from frontend) if provided, otherwise falls back
    to config values (from .env) and finally to hardcoded catalog.
    """
    providers = []

    for pid, (config_key, fetch_fn) in _FETCH_REGISTRY.items():
        # Determine the API key/base URL: override > config > None
        key_or_url = (
            override_keys.get(pid) if override_keys
            else getattr(config, config_key, None)
        )

        if key_or_url:
            try:
                models = await fetch_fn(key_or_url)
                if models:
                    providers.append({
                        "id": pid,
                        "label": _provider_label(pid),
                        "available": True,
                        "models": models,
                    })
                    continue
            except Exception:
                pass

        # Fallback to hardcoded catalog
        if pid in _HARDCODED_IDS:
            p = _provider(pid)
            if p is not None:
                providers.append({
                    "id": p.id,
                    "label": p.label,
                    "available": bool(key_or_url),
                    "models": [{"id": m.id, "label": m.label} for m in p.models],
                })

    # Determine default
    default = _default_selection(config, providers)

    return {
        "providers": providers,
        "default": {"provider": default[0], "model": default[1]},
    }


def _provider_label(pid: str) -> str:
    """Return a human-readable label for a provider id."""
    labels = {
        "openai": "OpenAI",
        "gemini": "Google Gemini",
        "openrouter": "OpenRouter",
        "deepseek": "DeepSeek",
        "glm": "GLM (Zhipu AI)",
        "ollama": "Ollama (local)",
    }
    return labels.get(pid, pid)


def _default_selection(
    config: CoreConfig,
    providers: list[dict],
) -> tuple[str, str]:
    """Pick the best default (provider, model) from available providers."""
    env_provider = config.llm_provider

    # Try to use the env-configured provider
    for p in providers:
        if p["id"] == env_provider and p["available"] and p["models"]:
            return (p["id"], p["models"][0]["id"])

    # Fall back to first available provider
    for p in providers:
        if p["available"] and p["models"]:
            return (p["id"], p["models"][0]["id"])

    # Last resort: first provider with models
    for p in providers:
        if p["models"]:
            return (p["id"], p["models"][0]["id"])

    return ("gemini", "gemini-2.5-flash")


def _provider_available(config: CoreConfig, pid: str) -> bool:
    """Check if a provider has its API key configured on the server."""
    key_map = {
        "openai": config.openai_api_key,
        "gemini": config.google_api_key,
        "openrouter": getattr(config, "openrouter_api_key", None),
        "deepseek": getattr(config, "deepseek_api_key", None),
        "glm": getattr(config, "glm_api_key", None),
    }
    if pid == "ollama":
        return True
    return bool(key_map.get(pid))


def _model_family(provider: str, model_id: str) -> str:
    """Return the family string for a validated (provider, model_id) pair."""
    if provider == "ollama":
        return "ollama"
    p = _provider(provider)
    if p is not None:
        for m in p.models:
            if m.id == model_id:
                return m.family
    return "openai-chat"


def resolve(
    provider: str | None,
    model: str | None,
    config: CoreConfig,
) -> tuple[str, str, str]:
    """Validate a requested ``(provider, model)`` pair, filling in defaults.

    Returns a ``(provider, model, family)`` triple.
    """
    if provider is None and model is None:
        prov, mdl = _default_selection(config, [])
        return (prov, mdl, _model_family(prov, mdl))

    if provider is None or model is None:
        raise ValueError(
            "Both 'provider' and 'model' must be supplied together; got "
            f"provider={provider!r} model={model!r}."
        )

    if provider == "ollama":
        if not model:
            raise ValueError("model must be non-empty for provider 'ollama'.")
        return ("ollama", model, "ollama")

    # For dynamic-only providers (openrouter, deepseek, glm), accept any model
    if provider in ("openrouter", "deepseek", "glm"):
        if not model:
            raise ValueError(f"model must be non-empty for provider {provider!r}.")
        return (provider, model, "openai-chat")

    p = _provider(provider)
    if p is None:
        known = ", ".join(_FETCH_REGISTRY.keys())
        raise ValueError(
            f"Unknown provider {provider!r}; supported providers: {known}."
        )

    if not _has_model(p, model):
        allowed = ", ".join(m.id for m in p.models)
        raise ValueError(
            f"Unknown model {model!r} for provider {provider!r}; "
            f"supported models: {allowed}."
        )

    if not _provider_available(config, p.id):
        raise ValueError(
            f"Provider {p.id!r} is selected but API key is not configured "
            "on the server."
        )

    return (p.id, model, _model_family(p.id, model))
