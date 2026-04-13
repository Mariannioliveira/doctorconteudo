from pathlib import Path

# Project root is 2 levels up from this file (webapp/core/config.py → project root)
PROJECT_ROOT = Path(__file__).parent.parent.parent
WEBAPP_ROOT = Path(__file__).parent.parent

SQUAD_NAME = "conteudo-social-medicos"
SQUAD_ROOT = PROJECT_ROOT / "squads" / SQUAD_NAME
MEMORY_ROOT = PROJECT_ROOT / "_opensquad" / "_memory"
ASSETS_ROOT = PROJECT_ROOT / "_opensquad" / "assets"

# Pipeline step → output files mapping
STEP_OUTPUT_FILES = {
    "step-01": ["v1/ranked-stories.yaml"],
    "step-03": ["v1/content-draft.md"],
    "step-04": ["v1/quality-review.md"],
    "step-06": ["design/card.html"],
    "step-08": ["v1/publish-report.md"],
}

# Checkpoint step → decision saves to which file
CHECKPOINT_SAVES = {
    "step-00": "research-period.json",
    "step-02": "selected-story.yaml",
    "step-05": "content-decision.json",
    "step-07": "publish-decision.json",
}
