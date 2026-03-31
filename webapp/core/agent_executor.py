"""
Builds prompts and calls the Anthropic API for each agent step.
Handles web_search tool for agents that require it.
"""
import asyncio
import json
import re
from pathlib import Path
from typing import Callable, AsyncIterator

import anthropic

from .config import ANTHROPIC_API_KEY, MODELS, SQUAD_ROOT, PROJECT_ROOT
from .file_manager import (
    load_agent_md, load_squad_yaml, load_memory_file,
    read_artifact, write_artifact, get_run_dir
)


# ─────────────────────────────────────────────
#  Public entry point
# ─────────────────────────────────────────────

async def execute_step(
    step: dict,
    run_id: str,
    last_decision: dict | None,
    on_token: Callable[[str], None] | None = None,
) -> str:
    """
    Execute an agent step. Returns the primary output content as a string.
    Saves all output files to the run directory.
    """
    agent_id = step.get("agent", "")
    agent_meta, agent_body = load_agent_md(agent_id)

    model_tier = agent_meta.get("model_tier", "standard")
    model = MODELS.get(model_tier, MODELS["standard"])
    skills = agent_meta.get("skills", [])

    system_prompt = _build_system_prompt(agent_body, run_id)
    user_message = _build_user_message(step, run_id, last_decision)

    if "web_search" in skills:
        output = await _call_with_web_search(
            model, system_prompt, user_message, on_token
        )
    else:
        output = await _call_streaming(
            model, system_prompt, user_message, on_token
        )

    # Save output to the appropriate file(s)
    _save_output(step["id"], run_id, output, agent_id)

    # Special post-processing for designer step
    if step["id"] == "step-09":
        await _render_card_to_jpg(run_id)

    return output


# ─────────────────────────────────────────────
#  Prompt builders
# ─────────────────────────────────────────────

def _build_system_prompt(agent_body: str, run_id: str) -> str:
    squad_yaml = load_squad_yaml()
    company_md = load_memory_file("company.md")
    preferences_md = load_memory_file("preferences.md")

    # Load data files declared in squad.yaml
    data_context = ""
    for data_path in squad_yaml.get("data", []):
        content = _read_project_file(data_path)
        if content:
            filename = Path(data_path).name
            data_context += f"\n\n---\n## {filename}\n{content}"

    parts = [
        "# Contexto da empresa",
        company_md,
        "# Preferências de output",
        preferences_md,
        "---",
        "# Sua persona e instruções",
        agent_body,
    ]
    if data_context:
        parts.append("# Dados do squad" + data_context)

    return "\n\n".join(p for p in parts if p.strip())


def _build_user_message(step: dict, run_id: str, last_decision: dict | None) -> str:
    step_id = step["id"]
    step_name = step.get("name", step_id)

    # Collect all relevant artifacts from the current run
    artifacts_context = _collect_artifacts_context(step_id, run_id)

    # Decision context from last checkpoint
    decision_context = ""
    if last_decision:
        action = last_decision.get("action", "")
        value = last_decision.get("value")
        feedback = last_decision.get("feedback", "")

        if step_id == "step-01":
            period = value if isinstance(value, str) else "15 dias"
            decision_context = f"\n**Período de pesquisa definido pelo usuário:** {period}\n"
            decision_context += f"Use exatamente este período como filtro de data nas suas buscas.\n"
        elif step_id == "step-05" and action == "request_changes":
            decision_context = f"\n**Feedback do usuário sobre o rascunho anterior:**\n{feedback}\nRevise o conteúdo considerando este feedback.\n"
        elif step_id == "step-05" and value:
            hook_letter = value if isinstance(value, str) else str(value)
            decision_context = f"\n**Hook escolhido pelo usuário:** Hook {hook_letter}\n"
        elif step_id == "step-09" and action == "adjust_copy":
            decision_context = f"\n**O usuário solicitou ajuste de copy antes do design. Use a versão mais recente do content-draft.md.**\n"

    # Expected output instructions
    output_instructions = _get_output_instructions(step_id)

    msg = f"""# Execute: {step_name}

{decision_context}

## Contexto disponível desta rodada
{artifacts_context}

## Sua tarefa
{output_instructions}

Entregue o resultado no formato especificado. Seja direto e completo."""

    return msg


def _collect_artifacts_context(step_id: str, run_id: str) -> str:
    """Load relevant artifacts from previous steps as context."""
    artifact_map = {
        "step-01": [],
        "step-03": ["v1/ranked-stories.yaml", "selected-story.yaml"],
        "step-05": ["v1/editorial-brief.md", "selected-story.yaml", "v1/selected-hook.yaml"],
        "step-07": ["v1/content-draft.md"],
        "step-09": ["v1/content-draft.md", "v1/quality-review.md"],
        "step-11": ["v1/content-draft.md", "design/card.html"],
    }
    files_to_load = artifact_map.get(step_id, [])
    parts = []
    for rel_path in files_to_load:
        content = read_artifact(run_id, rel_path)
        if content:
            parts.append(f"### {rel_path}\n```\n{content}\n```")
    return "\n\n".join(parts) if parts else "(Primeiro step — sem contexto anterior)"


def _get_output_instructions(step_id: str) -> str:
    instructions = {
        "step-01": (
            "Execute a pesquisa de notícias médicas usando as ferramentas de busca disponíveis.\n"
            "Retorne o resultado em formato YAML exatamente como especificado no seu Output Format:\n"
            "```yaml\nranked_stories:\n  - rank: 1\n    title: ...\n```\n"
            "Retorne APENAS o YAML, sem texto adicional antes ou depois."
        ),
        "step-03": (
            "Crie o brief editorial completo seguindo seu Output Format.\n"
            "Inclua: Ângulo Estratégico, Diagnóstico de Consciência, Big Idea, "
            "Formato do Carrossel, 3 Hooks com drivers diferentes, e Instruções para o Redator.\n"
            "Retorne o markdown completo do brief."
        ),
        "step-05": (
            "Crie o conteúdo completo: Card Único Instagram + Legenda.\n"
            "Siga exatamente o Output Format especificado:\n"
            "- Card Único com Headline, Palavras em destaque (#92adff), Visual, Footer\n"
            "- Legenda Instagram completa com hook, corpo, CTA e hashtags\n"
            "Use o hook escolhido pelo usuário como ponto de partida."
        ),
        "step-07": (
            "Revise o conteúdo seguindo seus critérios de avaliação.\n"
            "Avalie cada critério com score e justificativa.\n"
            "Emita um VEREDICTO claro: APROVAR, APROVAR COM RESSALVAS ou REJEITAR.\n"
            "Inclua feedback detalhado e, se rejeitado, o caminho para aprovação."
        ),
        "step-09": (
            "Crie o HTML do card Instagram seguindo exatamente o Design System fixo.\n"
            "Use os dados do content-draft.md: headline, palavras em destaque, descrição do visual.\n"
            "Gere um HTML completo e auto-contido (CSS inline, Google Fonts via @import).\n"
            "Retorne APENAS o HTML, começando com <!DOCTYPE html>."
        ),
        "step-11": (
            "Gere o relatório de publicação.\n"
            "Documente: data/hora, conteúdo publicado, plataformas, status.\n"
            "Nota: A publicação no Instagram via API requer autenticação manual. "
            "Inclua as instruções para publicação manual dos arquivos gerados.\n"
            "Retorne o relatório em markdown."
        ),
    }
    return instructions.get(step_id, "Execute sua tarefa conforme seu guia operacional.")


# ─────────────────────────────────────────────
#  Anthropic API calls
# ─────────────────────────────────────────────

async def _call_with_web_search(
    model: str,
    system: str,
    user_message: str,
    on_token: Callable[[str], None] | None,
) -> str:
    """Call Anthropic API with web_search tool enabled."""
    client = anthropic.AsyncAnthropic(api_key=ANTHROPIC_API_KEY)

    messages = [{"role": "user", "content": user_message}]
    full_text = ""

    try:
        # Try with web search tool (beta)
        response = await client.beta.messages.create(
            model=model,
            max_tokens=8096,
            system=system,
            messages=messages,
            tools=[{"type": "web_search_20250305", "name": "web_search"}],
            betas=["web-search-2025-03-05"],
        )

        for block in response.content:
            if hasattr(block, "text"):
                full_text += block.text
            elif block.type == "tool_result":
                pass  # search results are consumed internally by the model

        if on_token and full_text:
            on_token(full_text)

    except Exception as e:
        # Fallback: call without web search, inject date context
        if on_token:
            on_token(f"[Web search indisponível, usando conhecimento interno: {e}]\n\n")
        full_text = await _call_streaming(model, system, user_message, on_token)

    return full_text


async def _call_streaming(
    model: str,
    system: str,
    user_message: str,
    on_token: Callable[[str], None] | None,
) -> str:
    """Stream response from Anthropic API, calling on_token for each chunk."""
    client = anthropic.AsyncAnthropic(api_key=ANTHROPIC_API_KEY)
    full_text = ""

    async with client.messages.stream(
        model=model,
        max_tokens=8096,
        system=system,
        messages=[{"role": "user", "content": user_message}],
    ) as stream:
        async for text in stream.text_stream:
            full_text += text
            if on_token:
                on_token(text)

    return full_text


# ─────────────────────────────────────────────
#  Output saving
# ─────────────────────────────────────────────

def _save_output(step_id: str, run_id: str, content: str, agent_id: str):
    from .config import STEP_OUTPUT_FILES
    output_files = STEP_OUTPUT_FILES.get(step_id, [])
    for rel_path in output_files:
        write_artifact(run_id, rel_path, content)


async def _render_card_to_jpg(run_id: str):
    """Use Playwright to render card.html to card.jpg."""
    run_dir = get_run_dir(run_id)
    html_path = run_dir / "design" / "card.html"
    jpg_path = run_dir / "design" / "card.jpg"

    if not html_path.exists():
        return

    try:
        from playwright.async_api import async_playwright
        async with async_playwright() as p:
            browser = await p.chromium.launch()
            page = await browser.new_page()
            await page.set_viewport_size({"width": 1080, "height": 1350})
            await page.goto(f"file://{html_path.resolve()}")
            await page.wait_for_timeout(1500)  # wait for fonts to load
            await page.screenshot(path=str(jpg_path), full_page=False)
            await browser.close()
    except Exception as e:
        # Log but don't fail the pipeline
        print(f"[designer] Playwright render failed: {e}")
        # Create a placeholder note
        (run_dir / "design" / "render-error.txt").write_text(
            f"Render failed: {e}\nInstall Playwright: playwright install chromium"
        )


# ─────────────────────────────────────────────
#  Helpers
# ─────────────────────────────────────────────

def _read_project_file(rel_path: str) -> str:
    path = PROJECT_ROOT / rel_path
    if path.exists():
        return path.read_text(encoding="utf-8")
    # Also try relative to SQUAD_ROOT
    path2 = SQUAD_ROOT / rel_path.replace(f"squads/{SQUAD_ROOT.name}/", "")
    if path2.exists():
        return path2.read_text(encoding="utf-8")
    return ""
