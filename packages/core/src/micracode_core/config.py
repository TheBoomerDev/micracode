from __future__ import annotations

from pathlib import Path
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


def _default_output_dir() -> Path:
    return Path.home() / "opener-apps"


class CoreConfig(BaseSettings):
    model_config = SettingsConfigDict(
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    app_name: str = "micracode"
    environment: str = Field(default="development")
    log_level: str = Field(default="INFO")

    # --- LLM ------------------------------------------------------------------
    llm_provider: Literal["gemini", "openai", "ollama", "openrouter", "deepseek", "glm"] = Field(default="gemini")

    google_api_key: str = Field(default="")
    gemini_model: str = Field(default="gemini-2.5-flash")

    openai_api_key: str = Field(default="")
    openai_model: str = Field(default="")

    openrouter_api_key: str = Field(default="")
    deepseek_api_key: str = Field(default="")
    glm_api_key: str = Field(default="")

    ollama_base_url: str = Field(default="http://localhost:11434")
    ollama_model: str = Field(default="")

    @property
    def active_model(self) -> str:
        model_map = {
            "openai": self.openai_model,
            "gemini": self.gemini_model,
            "ollama": self.ollama_model,
        }
        if self.llm_provider in model_map:
            return model_map[self.llm_provider]
        # For openrouter/deepseek/glm/zai, return the provider name as hint
        return ""

    @property
    def active_api_key(self) -> str:
        key_map = {
            "openai": self.openai_api_key,
            "gemini": self.google_api_key,
            "openrouter": self.openrouter_api_key,
            "deepseek": self.deepseek_api_key,
            "glm": self.glm_api_key,
        }
        if self.llm_provider in key_map:
            return key_map[self.llm_provider]  # type: ignore[literal-required]
        return ""

    # --- Tool-calling loop ----------------------------------------------------
    max_tool_iterations: int = Field(default=20)
    shell_exec_output_limit: int = Field(default=8192)

    # --- Storage --------------------------------------------------------------
    opener_apps_dir: Path = Field(default_factory=_default_output_dir)
    project_type: str = Field(default="app", description='"app" for quick apps, "full" for extended projects')
