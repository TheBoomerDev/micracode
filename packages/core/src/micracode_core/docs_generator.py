"""Documentation generation for Micracode projects.

Uses the configured LLM to produce PRD, specs, functional/technical memory,
roadmap, buyer persona, and visual design specs. Saves them as markdown files
in the project's ``docs/`` directory.
"""

from __future__ import annotations

import json
import logging
from datetime import UTC, datetime
from pathlib import Path

from langchain_core.messages import HumanMessage, SystemMessage

from .config import CoreConfig
from .llm import LLMFactory
from .storage import Storage

logger = logging.getLogger(__name__)


DOC_SECTIONS = [
    {
        "id": "prd",
        "title": "Product Requirements Document (PRD)",
        "filename": "01-prd.md",
        "description": "Complete PRD covering problem statement, target audience, features, user stories, success metrics.",
    },
    {
        "id": "specs",
        "title": "Technical Specifications",
        "filename": "02-specs.md",
        "description": "Technical architecture, stack decisions, data model, API design, security considerations.",
    },
    {
        "id": "functional-memory",
        "title": "Functional Memory",
        "filename": "03-functional-memory.md",
        "description": "How the system behaves from a user perspective: workflows, state machines, edge cases.",
    },
    {
        "id": "technical-memory",
        "title": "Technical Memory",
        "filename": "04-technical-memory.md",
        "description": "Implementation details, dependencies, configuration, deployment, environment variables.",
    },
    {
        "id": "roadmap",
        "title": "Roadmap & Future Improvements",
        "filename": "05-roadmap.md",
        "description": "Phased development plan, v1 scope, v2 ambitions, potential pivots.",
    },
    {
        "id": "visual-design",
        "title": "Visual Identity & Design System",
        "filename": "06-visual-design.md",
        "description": "Color palette, typography, layout principles, component design, logo concepts.",
    },
    {
        "id": "buyer-persona",
        "title": "Buyer Persona & Target Audience",
        "filename": "07-buyer-persona.md",
        "description": "ICP definition, demographics, pain points, jobs-to-be-done, acquisition channels.",
    },
    {
        "id": "competitor-analysis",
        "title": "Competitor Analysis",
        "filename": "08-competitor-analysis.md",
        "description": "Market landscape, direct/indirect competitors, gaps identified, differentiation strategy.",
    },
]


def _build_system_prompt(project_name: str, user_prompt: str) -> str:
    return f"""You are a senior product manager and technical architect. You are helping build a project called "{project_name}".

The user's initial description is:
{user_prompt}

Your task is to produce comprehensive project documentation in markdown format.
Each section should be thorough, actionable, and grounded in real-world best practices.
Include specific technical recommendations where applicable.
Use clear headings, bullet points, and tables where appropriate.

Respond with a JSON object where each key is a section id and each value is the markdown content for that section.
Only include sections that have relevant content to contribute."""


async def generate_all_docs(
    project_name: str,
    user_prompt: str,
    storage: Storage,
    project_slug: str,
    config: CoreConfig | None = None,
) -> list[dict]:
    """Generate all documentation sections using the LLM and save to docs/.

    Returns a list of dicts with keys: id, title, filename, success, error.
    """
    cfg = config or CoreConfig()
    results = []
    docs_dir = storage.project_dir(project_slug) / "docs"
    docs_dir.mkdir(parents=True, exist_ok=True)

    # Build the LLM once
    llm = LLMFactory.build(config=cfg, temperature=0.3, streaming=False)

    system = _build_system_prompt(project_name, user_prompt)
    section_ids = [s["id"] for s in DOC_SECTIONS]
    section_list = "\n".join(f"- {s['id']}: {s['title']} — {s['description']}" for s in DOC_SECTIONS)

    try:
        user_msg = f"""Generate ALL of the following documentation sections for this project:

{section_list}

Return ONLY a JSON object like:
{{
  "prd": "# PRD\\n\\n...",
  "specs": "# Technical Specifications\\n\\n...",
  ...
}}

Make each section thorough and actionable. Use proper markdown formatting."""

        response = await llm.ainvoke([
            SystemMessage(content=system),
            HumanMessage(content=user_msg),
        ])

        content = response.content.strip()
        # Remove markdown code fences if present
        if content.startswith("```"):
            content = content.split("\n", 1)[1]
            if "```" in content:
                content = content.rsplit("```", 1)[0]
            content = content.strip()
        if content.startswith("json"):
            content = content[4:].strip()

        parsed: dict = json.loads(content)

        for section in DOC_SECTIONS:
            sid = section["id"]
            markdown = parsed.get(sid, "")
            if not markdown:
                results.append({**section, "success": False, "error": "No content generated"})
                continue

            filepath = docs_dir / section["filename"]
            # Add header metadata
            full_content = f"""---
title: {section['title']}
project: {project_name}
generated_at: {datetime.now(UTC).isoformat()}
---

{markdown}
"""
            try:
                filepath.write_text(full_content, encoding="utf-8")
                results.append({**section, "success": True, "error": None})
                logger.info("Generated docs/%s for %s", section["filename"], project_slug)
            except OSError as exc:
                results.append({**section, "success": False, "error": str(exc)})

    except json.JSONDecodeError as exc:
        logger.error("Failed to parse LLM response as JSON: %s", exc)
        # Fall back: save raw response
        raw_path = docs_dir / "00-raw-response.md"
        raw_path.write_text(f"# Raw LLM Response\n\n{response.content}\n", encoding="utf-8")
        for section in DOC_SECTIONS:
            results.append({**section, "success": False, "error": f"JSON parse failed: {exc}"})

    except Exception as exc:
        logger.exception("Docs generation failed for %s", project_slug)
        for section in DOC_SECTIONS:
            results.append({**section, "success": False, "error": str(exc)})
        return results

    return results
