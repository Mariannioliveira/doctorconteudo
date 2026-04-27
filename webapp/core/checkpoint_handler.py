"""
Maps step IDs to checkpoint payload builders.
Each function reads current run artifacts and returns a structured payload
that the frontend uses to render the checkpoint UI.
"""
import yaml
import re
from pathlib import Path
from .file_manager import read_artifact, list_design_files, get_card_html_url, get_run_dir


def _strip_code_fences(text: str) -> str:
    text = text.strip()
    text = re.sub(r'^```[a-zA-Z]*\s*\n?', '', text)
    text = re.sub(r'\n?```\s*$', '', text)
    return text.strip()


def build_payload(step_id: str, run_id: str) -> dict:
    builders = {
        "step-00": _period_selection,
        "step-02": _story_selection,
        "step-05": _content_review,
        "step-07": _design_approval,
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
                "label": "7 dias — últimos 7 dias",
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
            clean = _strip_code_fences(raw)
            data = yaml.safe_load(clean)
            if isinstance(data, dict):
                stories = data.get("ranked_stories", data.get("stories", []))
            elif isinstance(data, list):
                stories = data
        except Exception:
            pass
    return {
        "type": "story_selection",
        "title": f"Dr. Scout encontrou {len(stories)} notícias",
        "subtitle": "Escolha a notícia desta rodada",
        "stories": stories,
        "actions": [
            {"action": "select", "label": "Confirmar notícia selecionada", "style": "primary"},
        ],
    }


# ─────────────────────────────────────────────
#  Step 04 — Aprovação do Conteúdo (após revisor)
# ─────────────────────────────────────────────

def _content_review(run_id: str) -> dict:
    draft_raw = read_artifact(run_id, "v1/content-draft.md")
    review_raw = read_artifact(run_id, "v1/quality-review.md")

    draft_md = _strip_code_fences(draft_raw) if draft_raw else ""
    review_md = _strip_code_fences(review_raw) if review_raw else ""

    # Extract headline for subtitle
    headline = ""
    m = re.search(r'=== HEADLINE DO CARD ===\s*\n(.+)', draft_md)
    if m:
        headline = m.group(1).strip()

    # Extract verdict
    verdict = "—"
    mv = re.search(r'VEREDICTO:\s*(.+)', review_md)
    if mv:
        verdict = mv.group(1).strip()

    return {
        "type": "content_review",
        "title": "Carlos Cópia criou o conteúdo",
        "subtitle": f'"{headline}"' if headline else f"Veredicto: {verdict}",
        "draft_md": draft_md,
        "review_md": review_md,
        "verdict": verdict,
        "actions": [
            {"action": "create_design", "label": "Criar design", "style": "primary"},
            {"action": "request_changes", "label": "Ajustar conteúdo", "style": "secondary", "has_feedback": True},
            {"action": "save_draft", "label": "Salvar rascunho", "style": "ghost"},
        ],
    }


# ─────────────────────────────────────────────
#  Step 06 — Aprovação para Publicação
# ─────────────────────────────────────────────

def _design_approval(run_id: str) -> dict:
    slides = list_design_files(run_id)
    card_html_url = get_card_html_url(run_id)

    # Load caption for preview
    draft = read_artifact(run_id, "v1/content-draft.md")
    caption = ""
    if draft:
        m = re.search(r'=== LEGENDA INSTAGRAM ===\s*\n(.*?)(?:\n===|\Z)', draft, re.DOTALL)
        if m:
            # Send the full caption so the dashboard can render it complete.
            # Trim only at a hard ceiling that's safely above any real caption.
            caption = m.group(1).strip()[:8000]

    has_design = len(slides) > 0 or bool(card_html_url)
    subtitle = "Card gerado — pronto para publicar" if has_design else "Aguardando geração do card..."

    return {
        "type": "design_approval",
        "title": "Marco Design criou o card",
        "subtitle": subtitle,
        "slides": slides,
        "card_html_url": card_html_url,
        "caption": caption,
        "run_id": run_id,
        "actions": [
            {"action": "publish", "label": "Publicar agora", "style": "primary"},
            {"action": "adjust_design", "label": "Ajustar design", "style": "secondary"},
            {"action": "download", "label": "Baixar imagem", "style": "ghost"},
        ]
    }
