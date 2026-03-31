from pathlib import Path
import os
from dotenv import load_dotenv

# Project root is 2 levels up from this file (webapp/core/config.py → project root)
PROJECT_ROOT = Path(__file__).parent.parent.parent
WEBAPP_ROOT = Path(__file__).parent.parent

# Load .env from project root
load_dotenv(PROJECT_ROOT / ".env")

SQUAD_NAME = "conteudo-social-medicos"
SQUAD_ROOT = PROJECT_ROOT / "squads" / SQUAD_NAME
MEMORY_ROOT = PROJECT_ROOT / "_opensquad" / "_memory"
ASSETS_ROOT = PROJECT_ROOT / "_opensquad" / "assets"

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")

# Model tiers — match squad agent definitions
MODELS = {
    "fast": "claude-haiku-4-5-20251001",
    "standard": "claude-sonnet-4-6",
    "powerful": "claude-opus-4-6",
}

# Pipeline step → output files mapping
STEP_OUTPUT_FILES = {
    "step-01": ["v1/ranked-stories.yaml"],
    "step-03": ["v1/editorial-brief.md"],
    "step-05": ["v1/content-draft.md"],
    "step-07": ["v1/quality-review.md"],
    "step-09": ["design/card.html"],
    "step-11": ["v1/publish-report.md"],
}

# Checkpoint step → decision saves to which file
CHECKPOINT_SAVES = {
    "step-00": "research-period.json",
    "step-02": "selected-story.yaml",
    "step-04": "v1/selected-hook.yaml",
    "step-06": "draft-decision.json",
    "step-08": "design-decision.json",
    "step-10": "publish-decision.json",
}
