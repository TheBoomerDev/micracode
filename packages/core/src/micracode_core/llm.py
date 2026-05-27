"""Provider-agnostic LLM factory."""

from __future__ import annotations

from typing import Any

from langchain_core.language_models.chat_models import BaseChatModel
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_ollama import ChatOllama
from langchain_openai import ChatOpenAI

from .config import CoreConfig


# OpenAI-compatible providers with their base URLs and config key mappings
_OPENAI_COMPAT: dict[str, dict[str, str]] = {
    "openai": {
        "base_url": "https://api.openai.com/v1",
        "api_key_attr": "openai_api_key",
        "model_attr": "openai_model",
    },
    "openrouter": {
        "base_url": "https://openrouter.ai/api/v1",
        "api_key_attr": "openrouter_api_key",
        "model_attr": "",
    },
    "deepseek": {
        "base_url": "https://api.deepseek.com/v1",
        "api_key_attr": "deepseek_api_key",
        "model_attr": "",
    },
    "glm": {
        "base_url": "https://open.bigmodel.cn/api/paas/v4",
        "api_key_attr": "glm_api_key",
        "model_attr": "",
    },
    "zai": {
        "base_url": "https://api.01.ai/v1",
        "api_key_attr": "zai_api_key",
        "model_attr": "",
    },
}


class LLMFactory:
    """Build a ``BaseChatModel`` by logical name."""

    @staticmethod
    def build(
        config: CoreConfig | None = None,
        provider: str | None = None,
        model: str | None = None,
        *,
        temperature: float = 0.2,
        streaming: bool = True,
        **kwargs: Any,
    ) -> BaseChatModel:
        cfg = config or CoreConfig()
        resolved_provider = provider or cfg.llm_provider

        if resolved_provider == "gemini":
            return ChatGoogleGenerativeAI(
                model=model or cfg.gemini_model,
                google_api_key=cfg.google_api_key or None,
                temperature=temperature,
                **kwargs,
            )

        if resolved_provider == "ollama":
            resolved_model = model or cfg.ollama_model
            if not resolved_model:
                raise ValueError("OLLAMA_MODEL is not set; required when LLM_PROVIDER=ollama.")
            return ChatOllama(
                model=resolved_model,
                base_url=cfg.ollama_base_url,
                temperature=temperature,
                **kwargs,
            )

        # OpenAI-compatible providers
        compat = _OPENAI_COMPAT.get(resolved_provider)
        if compat is not None:
            resolved_model = model or ""
            if not resolved_model:
                # Try configured model from config
                if compat.get("model_attr"):
                    resolved_model = getattr(cfg, compat["model_attr"], "") or ""
                if not resolved_model:
                    raise ValueError(
                        f"Model is not set; required when LLM_PROVIDER={resolved_provider}."
                    )

            api_key = getattr(cfg, compat["api_key_attr"], None) or None
            openai_kwargs: dict[str, Any] = {
                "model": resolved_model,
                "api_key": api_key,
                "base_url": compat["base_url"],
                "streaming": streaming,
                **kwargs,
            }
            if not resolved_model.startswith("gpt-5"):
                openai_kwargs["temperature"] = temperature
            return ChatOpenAI(**openai_kwargs)

        raise ValueError(f"Unsupported LLM provider: {resolved_provider!r}")


def build_default_llm(config: CoreConfig | None = None) -> BaseChatModel:
    return LLMFactory.build(config)
