"""
Handles all file I/O for squad configuration and run artifacts.
"""
import json
import yaml
import frontmatter
from pathlib import Path
from datetime import datetime, timezone

from .config import (
    SQUAD_ROOT, MEMORY_ROOT, PROJECT_ROOT,
    SQUAD_NAME, STEP_OUTPUT_FILES, CHECKPOINT_SAVES
)


# ─────────────────────────────────────────────
#  Squad config readers
# ─────────────────────────────────────────────

def load_squad_yaml() -> dict:
    return yaml.safe_load((SQUAD_ROOT / "squad.yaml").read_text())


def load_pipeline_yaml() -> dict:
    return yaml.safe_load((SQUAD_ROOT / "pipeline" / "pipeline.yaml").read_text())


def load_agent_md(agent_id: str) -> tuple[dict, str]:
    """Returns (frontmatter_dict, body_text) for an agent markdown file."""
    path = SQUAD_ROOT / "agents" / f"{agent_id}.agent.md"
    post = frontmatter.load(str(path))
    return post.metadata, post.content


def load_step_md(step_file: str) -> tuple[dict, str]:
    """Returns (frontmatter_dict, body_text) for a step markdown file."""
    path = SQUAD_ROOT / "pipeline" / "steps" / step_file
    post = frontmatter.load(str(path))
    return post.metadata, post.content


def load_data_file(rel_path: str) -> str:
    """Load a data file referenced in squad.yaml (relative to project root)."""
    path = PROJECT_ROOT / rel_path
    if path.exists():
        return path.read_text()
    return ""


def load_memory_file(filename: str) -> str:
    path = MEMORY_ROOT / filename
    if path.exists():
        return path.read_text()
    return ""


# ─────────────────────────────────────────────
#  Run artifact helpers
# ─────────────────────────────────────────────

def get_run_dir(run_id: str) -> Path:
    return SQUAD_ROOT / "output" / run_id


def init_run_dir(run_id: str) -> Path:
    run_dir = get_run_dir(run_id)
    (run_dir / "v1").mkdir(parents=True, exist_ok=True)
    (run_dir / "design").mkdir(parents=True, exist_ok=True)
    return run_dir


def write_artifact(run_id: str, rel_path: str, content: str):
    run_dir = get_run_dir(run_id)
    target = run_dir / rel_path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding="utf-8")


def read_artifact(run_id: str, rel_path: str) -> str:
    path = get_run_dir(run_id) / rel_path
    if path.exists():
        return path.read_text(encoding="utf-8")
    return ""


def artifact_exists(run_id: str, rel_path: str) -> bool:
    return (get_run_dir(run_id) / rel_path).exists()


def list_design_files(run_id: str) -> list[str]:
    """Returns URL paths to design *artworks* (the actual card outputs), served via /squad-output/.

    Skips internal asset copies like the brand logo, which we duplicate into the design
    folder only so card.html can reference it as a same-folder relative path.
    """
    design_dir = get_run_dir(run_id) / "design"
    if not design_dir.exists():
        return []
    squad_name = SQUAD_ROOT.name
    INTERNAL_ASSET_NAMES = {"logo-doctorcreator.png"}
    return sorted([
        f"/squad-output/{squad_name}/output/{run_id}/design/{f.name}"
        for f in design_dir.iterdir()
        if f.suffix.lower() in (".jpg", ".jpeg", ".png")
        and f.name not in INTERNAL_ASSET_NAMES
        and not f.name.startswith("img-bg")
    ])


def get_card_html_url(run_id: str) -> str | None:
    """Returns the URL to card.html if it exists, for iframe display."""
    html_path = get_run_dir(run_id) / "design" / "card.html"
    if html_path.exists():
        squad_name = SQUAD_ROOT.name
        return f"/squad-output/{squad_name}/output/{run_id}/design/card.html"
    return None


def save_checkpoint_decision(run_id: str, step_id: str, decision: dict):
    filename = CHECKPOINT_SAVES.get(step_id, f"{step_id}-decision.json")
    run_dir = get_run_dir(run_id)
    target = run_dir / filename
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(decision, ensure_ascii=False, indent=2))


def load_checkpoint_decision(run_id: str, step_id: str) -> dict:
    filename = CHECKPOINT_SAVES.get(step_id, f"{step_id}-decision.json")
    path = get_run_dir(run_id) / filename
    if path.exists():
        try:
            return json.loads(path.read_text())
        except Exception:
            return {}
    return {}


# ─────────────────────────────────────────────
#  Run state management
# ─────────────────────────────────────────────

def save_run_state(state: dict):
    run_dir = get_run_dir(state["run_id"])
    run_dir.mkdir(parents=True, exist_ok=True)
    (run_dir / "state.json").write_text(
        json.dumps(state, ensure_ascii=False, indent=2)
    )


def load_run_state(run_id: str) -> dict | None:
    path = get_run_dir(run_id) / "state.json"
    if path.exists():
        return json.loads(path.read_text())
    return None


def list_runs() -> list[dict]:
    output_dir = SQUAD_ROOT / "output"
    if not output_dir.exists():
        return []
    runs = []
    for d in sorted(output_dir.iterdir(), reverse=True):
        if not d.is_dir():
            continue
        state_file = d / "state.json"
        if state_file.exists():
            try:
                state = json.loads(state_file.read_text())
                runs.append({
                    "run_id": d.name,
                    "squad": state.get("squad", SQUAD_NAME),
                    "status": state.get("status", "unknown"),
                    "started_at": state.get("started_at", ""),
                    "current_step": state.get("current_step"),
                })
            except Exception:
                pass
    return runs


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()
