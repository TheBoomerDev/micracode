from __future__ import annotations

import json

from fastapi import APIRouter, Request

from micracode_core.model_catalog import list_catalog

from ..config import get_settings

router = APIRouter()


@router.get("/models")
async def models(request: Request) -> dict:
    """List available models.

    Accepts optional ``keys`` query param with JSON-encoded dict of
    ``{provider_id: api_key}`` from the frontend Settings panel.
    When provided, the server fetches models directly from each provider's API.
    Otherwise falls back to server-configured keys or hardcoded catalog.
    """
    override_keys: dict[str, str] | None = None
    raw = request.query_params.get("keys")
    if raw:
        try:
            override_keys = json.loads(raw)
        except (json.JSONDecodeError, TypeError):
            pass

    return await list_catalog(get_settings(), override_keys=override_keys)
