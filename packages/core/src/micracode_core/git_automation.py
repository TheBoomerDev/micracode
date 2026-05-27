"""Git automation for Micracode projects.

Initializes git repos, creates .gitignore, and makes conventional commits.
"""

from __future__ import annotations

import logging
import subprocess
import sys
from pathlib import Path

logger = logging.getLogger(__name__)

GITIGNORE_CONTENT = """# Dependencies
node_modules/
.pnp
.pnp.js

# Build
.next/
dist/
build/
.cache/
.turbo/

# Environment
.env
.env.local
.env.*.local

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Python
__pycache__/
*.py[cod]
*$py.class
*.egg-info/
.venv/
venv/

# Logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Coverage
coverage/
.coverage
htmlcov/
"""


def init_git(project_dir: Path, project_name: str) -> dict:
    """Initialize a git repo in project_dir, create .gitignore, and commit.

    Returns dict with success, repo_dir, and commit_sha.
    """
    if not project_dir.exists():
        return {"success": False, "error": f"Directory does not exist: {project_dir}"}

    # Check if git is available
    try:
        subprocess.run(
            ["git", "--version"],
            capture_output=True,
            check=True,
        )
    except (subprocess.CalledProcessError, FileNotFoundError):
        return {"success": False, "error": "git is not installed"}

    # Check if already a git repo
    if (project_dir / ".git").exists():
        return {"success": True, "note": "already a git repository", "repo_dir": str(project_dir)}

    try:
        subprocess.run(
            ["git", "init"],
            cwd=project_dir,
            capture_output=True,
            check=True,
        )

        subprocess.run(
            ["git", "checkout", "-b", "main"],
            cwd=project_dir,
            capture_output=True,
            check=True,
        )

        # Write .gitignore
        gitignore = project_dir / ".gitignore"
        if not gitignore.exists():
            gitignore.write_text(GITIGNORE_CONTENT, encoding="utf-8")

        # Stage everything and commit
        subprocess.run(["git", "add", "-A"], cwd=project_dir, capture_output=True, check=True)

        result = subprocess.run(
            ["git", "commit", "-m", f"feat: initial {project_name} project scaffold"],
            cwd=project_dir,
            capture_output=True,
            text=True,
        )

        if result.returncode == 0:
            sha = result.stdout.strip() if result.stdout else ""
            return {
                "success": True,
                "repo_dir": str(project_dir),
                "commit_sha": sha,
                "note": "initialized and committed",
            }
        else:
            return {
                "success": True,
                "repo_dir": str(project_dir),
                "note": f"initialized but commit had issues: {result.stderr.strip()}",
            }

    except subprocess.CalledProcessError as exc:
        logger.error("Git init failed: %s", exc)
        return {"success": False, "error": str(exc)}


def init_project_git(storage_path: Path, project_slug: str) -> list[dict]:
    """Initialize git repos for all subdirectories of a project.

    For full projects, initializes separate repos for code/ and docs/.
    For app projects, initializes a single repo at the project root.
    """
    results = []
    project_dir = storage_path / project_slug

    # Check project.json to determine type
    project_json = project_dir / ".micracode" / "project.json"
    is_full = False
    project_name = project_slug

    if project_json.exists():
        import json
        try:
            data = json.loads(project_json.read_text(encoding="utf-8"))
            project_name = data.get("name", project_slug)
            is_full = data.get("project_type") == "full"
        except (json.JSONDecodeError, OSError):
            pass

    if is_full:
        # Init code/ repo
        code_dir = project_dir / "code"
        if code_dir.exists():
            results.append(init_git(code_dir, f"{project_name} (code)"))

        # Init docs/ repo
        docs_dir = project_dir / "docs"
        if docs_dir.exists():
            results.append(init_git(docs_dir, f"{project_name} (docs)"))

        # Also init root with project.json and .micracode
        results.append(init_git(project_dir, f"{project_name} (meta)"))
    else:
        # Single repo at project root
        results.append(init_git(project_dir, project_name))

    return results
