"""
Maps step IDs to checkpoint payload builders.
Each function reads current run artifacts and returns a structured payload
that the frontend uses to render the checkpoint UI.
"""
import yaml
import re
from pathlib import Path
from .file_manager import read_artifact, list_design_files, get_run_dir


def build_payload(step_id: str, run_id: str) -> dict:
    builders = {
        "step-00": _period_selection,
        "step-02": _story_selection,
        "step-04": _hook_selection,
        "step-06": _draft_review,
        "step-08": _quality_decision,
        "step-10": _design_approval,
    }
    builder = builders.get(step_id)
    if builder:
        return builder(run_id)
    return {"type": "generic", "content": ""}


# ─────────────────────────────────────────────
#  Step 00 — Período de Pesquisa
# ─────────────────────────────────────────────

def _period_selection(_run_id: str) -> dict:
    return {
        "type": "period_selection",
        "title": "Configurando a pesquisa de notícias",
        "subtitle": "Até quanto tempo atrás o Dr. Scout deve buscar notícias médicas?",
        "options": [
            {
                "value": "7 dias",
                "label": "7 dias — 1 semana",
                "description": "Apenas as notícias mais recentes e frescas"
            },
            {
                "value": "15 dias",
                "label": "15 dias",
                "description": "Equilíbrio entre frescor e volume de resultados"
            },
            {
                "value": "30 dias",
                "label": "30 dias",
                "description": "Maior variedade, incluindo tendências recentes"
            },
        ]
    }


# ─────────────────────────────────────────────
#  Step 02 — Escolha do Tema
# ─────────────────────────────────────────────

def _story_selection(run_id: str) -> dict:
    raw = read_artifact(run_id, "v1/ranked-stories.yaml")
    stories = []
    if raw:
        try:
            data = yaml.safe_load(raw)
            stories = data.get("ranked_stories", [])
        except Exception:
            pass
    return {
        "type": "story_selection",
        "title": f"Dr. Scout encontrou {len(stories)} notícias",
        "subtitle": "Escolha o tema desta rodada de conteúdo",
        "stories": stories,
    }


# ─────────────────────────────────────────────
#  Step 04 — Aprovação do Brief e Escolha do Hook
# ─────────────────────────────────────────────

def _hook_selection(run_id: str) -> dict:
    brief_md = read_artifact(run_id, "v1/editorial-brief.md")
    hooks = _extract_hooks(brief_md)
    return {
        "type": "hook_selection",
        "title": "Ana Estratégia entregou o brief",
        "subtitle": "Aprove o ângulo e escolha um hook",
        "brief_md": brief_md,
        "hooks": hooks,
    }


def _extract_hooks(brief_md: str) -> list[dict]:
    """Parse the 3 hooks from the editorial-brief.md format."""
    hooks = []
    pattern = re.compile(
        r'###\s*Hook\s+([ABC])\s*[—–-]\s*\[Driver:\s*(.+?)\]\s*\n'
        r'```\s*\n(.*?)\n```\s*\n\*Rationale:\s*(.+?)\*',
        re.DOTALL | re.IGNORECASE
    )
    for match in pattern.finditer(brief_md):
        letter, driver, text, rationale = match.groups()
        hooks.append({
            "letter": letter.upper(),
            "driver": driver.strip(),
            "text": text.strip(),
            "rationale": rationale.strip(),
        })
    return hooks


# ─────────────────────────────────────────────
#  Step 06 — Revisão do Rascunho
# ─────────────────────────────────────────────

def _draft_review(run_id: str) -> dict:
    draft_md = read_artifact(run_id, "v1/content-draft.md")
    return {
        "type": "draft_review",
        "title": "Carlos Cópia entregou o rascunho",
        "subtitle": "Revise o conteúdo completo",
        "draft_md": draft_md,
        "actions": [
            {"action": "approve", "label": "Aprovado!", "style": "primary"},
            {"action": "request_changes", "label": "Precisa de ajustes", "style": "secondary", "has_feedback": True},
            {"action": "change_angle", "label": "Mudar o ângulo", "style": "danger"},
        ]
    }


# ─────────────────────────────────────────────
#  Step 08 — Aprovação para Design
# ─────────────────────────────────────────────

def _quality_decision(run_id: str) -> dict:
    review_md = read_artifact(run_id, "v1/quality-review.md")
    verdict = _extract_verdict(review_md)
    return {
        "type": "quality_decision",
        "title": "Vera Veredito avaliou o conteúdo",
        "subtitle": f"Veredicto: {verdict}",
        "review_md": review_md,
        "verdict": verdict,
        "actions": [
            {"action": "create_design", "label": "Criar design agora", "style": "primary"},
            {"action": "adjust_copy", "label": "Ajustar copy antes", "style": "secondary"},
            {"action": "save_draft", "label": "Salvar rascunho", "style": "ghost"},
        ]
    }


def _extract_verdict(review_md: str) -> str:
    match = re.search(r'VEREDICTO:\s*(.+)', review_md)
    if match:
        return match.group(1).strip()
    return "—"


# ─────────────────────────────────────────────
#  Step 10 — Aprovação para Publicação
# ─────────────────────────────────────────────

def _design_approval(run_id: str) -> dict:
    slides = list_design_files(run_id)
    return {
        "type": "design_approval",
        "title": "Marco Design criou o card",
        "subtitle": f"{len(slides)} arquivo(s) gerado(s)",
        "slides": slides,
        "run_id": run_id,
        "actions": [
            {"action": "publish", "label": "Publicar agora", "style": "primary"},
            {"action": "adjust_design", "label": "Ajustar design", "style": "secondary"},
            {"action": "save", "label": "Salvar sem publicar", "style": "ghost"},
        ]
    }
