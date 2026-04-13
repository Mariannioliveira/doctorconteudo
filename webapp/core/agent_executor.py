"""
Builds prompts and calls the Claude CLI for each agent step.

Authentication:
  Set ANTHROPIC_API_KEY in webapp/.env. The subprocess runs with --bare,
  which forces the CLI to use only that key, ignoring any OAuth session
  logged in the terminal. This pins execution to a specific account regardless
  of what is logged in Cursor, the desktop app, or any other terminal.

News research (step-01):
  Articles are pre-fetched via DuckDuckGo News (no API key required) before
  calling Claude. The researcher agent receives the raw articles and only needs
  to rank/filter them — web_search skill is not used, saving Claude usage.
"""
import asyncio
import json
import os
from pathlib import Path
from typing import Callable

from dotenv import dotenv_values

from .config import SQUAD_ROOT, PROJECT_ROOT
from .file_manager import (
    load_agent_md, load_squad_yaml, load_memory_file,
    read_artifact, write_artifact, get_run_dir
)

# Load project-level .env (webapp/.env)
_WEBAPP_ROOT = Path(__file__).parent.parent
_DOTENV_PATH = _WEBAPP_ROOT / ".env"
_DOTENV = dotenv_values(_DOTENV_PATH)

ANTHROPIC_API_KEY: str | None = _DOTENV.get("ANTHROPIC_API_KEY") or os.environ.get("ANTHROPIC_API_KEY") or None


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
    Execute an agent step via Claude CLI.
    Returns the primary output content as a string.
    Saves all output files to the run directory.
    """
    # step-08 (publicador) runs the Instagram publish script — does not call Claude
    if step.get("id") == "step-08":
        output = await _execute_publish(run_id, on_token)
        _save_output("step-08", run_id, output, "publicador")
        return output

    agent_id = step.get("agent", "")
    agent_meta, agent_body = load_agent_md(agent_id)

    # step-01: pre-fetch news externally so Claude only ranks, no web_search used
    prefetched_news = ""
    if step.get("id") == "step-01":
        from .news_fetcher import fetch_news
        period_days = _get_research_period(run_id)
        prefetched_news = fetch_news(research_period_days=period_days)

    # Never pass web_search to Claude for step-01 — articles are pre-fetched
    skills = agent_meta.get("skills", [])
    has_web_search = "web_search" in skills and step.get("id") != "step-01"

    system_prompt = _build_system_prompt(agent_body, run_id)
    user_message = _build_user_message(step, run_id, last_decision)

    if prefetched_news:
        user_message = prefetched_news + "\n\n---\n\n" + user_message

    model_tier = agent_meta.get("model_tier", "standard")
    output = await _call_claude_cli(
        system_prompt, user_message, on_token,
        web_search=has_web_search, model_tier=model_tier,
    )

    _save_output(step["id"], run_id, output, agent_id)

    if step["id"] == "step-06":
        await _render_card_to_jpg(run_id)

    return output


# ─────────────────────────────────────────────
#  Prompt builders
# ─────────────────────────────────────────────

def _build_system_prompt(agent_body: str, run_id: str) -> str:
    squad_yaml = load_squad_yaml()
    company_md = load_memory_file("company.md")
    preferences_md = load_memory_file("preferences.md")

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


def _get_research_period(run_id: str) -> int:
    """Reads the research period (days) chosen at step-00. Defaults to 30."""
    import json as _json
    raw = read_artifact(run_id, "research-period.json")
    if raw:
        try:
            data = _json.loads(raw)
            value = data.get("value", "30 dias")
            return int(str(value).split()[0])
        except Exception:
            pass
    return 30


def _build_user_message(step: dict, run_id: str, last_decision: dict | None) -> str:
    from datetime import datetime, timezone
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    step_id = step["id"]
    step_name = step.get("name", step_id)
    artifacts_context = _collect_artifacts_context(step_id, run_id)

    decision_context = ""
    if last_decision:
        action = last_decision.get("action", "")
        value = last_decision.get("value")
        feedback = last_decision.get("feedback", "")

        if step_id == "step-01":
            period = value if isinstance(value, str) else "15 dias"
            decision_context = f"\n**Data de hoje:** {today}\n"
            decision_context += f"**Período de pesquisa definido pelo usuário:** {period}\n"
            decision_context += f"Busque APENAS notícias publicadas nos últimos {period} a partir de {today}. Filtre por data nas suas buscas.\n"
        elif step_id == "step-03" and action == "request_changes":
            decision_context = f"\n**Feedback do usuário sobre o rascunho anterior:**\n{feedback}\nRevise o conteúdo considerando este feedback.\n"
        elif step_id == "step-06" and action == "adjust_design":
            decision_context = "\n**O usuário solicitou ajuste no design. Use a versão mais recente do content-draft.md.**\n"

    output_instructions = _get_output_instructions(step_id)

    return f"""# Execute: {step_name}
**Data atual:** {today}

{decision_context}

## Contexto disponível desta rodada
{artifacts_context}

## Sua tarefa
{output_instructions}

Entregue o resultado no formato especificado. Seja direto e completo."""


def _collect_artifacts_context(step_id: str, run_id: str) -> str:
    artifact_map = {
        "step-01": [],
        "step-03": ["v1/ranked-stories.yaml", "selected-story.yaml"],
        "step-04": ["v1/content-draft.md"],
        "step-06": ["v1/content-draft.md", "v1/quality-review.md"],
        "step-08": ["v1/content-draft.md", "design/card.html"],
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
            "Crie o conteúdo completo para a card única no Instagram.\n"
            "Leia a notícia selecionada em selected-story.yaml e siga exatamente o seu Output Format:\n\n"
            "=== HEADLINE DO CARD ===\n"
            "[Headline factual — max 10 palavras, estilo manchete de jornal]\n\n"
            "=== PALAVRAS EM DESTAQUE (#92adff) ===\n"
            "[palavra1], [expressão2]\n\n"
            "=== DESCRIÇÃO DO VISUAL ===\n"
            "[Descrição da foto de fundo ideal]\n\n"
            "=== LEGENDA INSTAGRAM ===\n"
            "[Legenda educacional completa + (Fonte: veículo) + hashtags]\n\n"
            "Tudo em português do Brasil. Não inclua texto fora deste formato."
        ),
        "step-04": (
            "Revise o conteúdo criado pelo Carlos Cópia (content-draft.md).\n"
            "Avalie headline e legenda seguindo seus critérios.\n"
            "Emita um VEREDICTO claro: APROVAR, APROVAR COM RESSALVAS ou REJEITAR.\n"
            "Retorne a revisão no seu Output Format."
        ),
        "step-06": (
            "Crie o HTML do card Instagram seguindo exatamente o Design System fixo.\n"
            "Leia o content-draft.md para obter: headline (=== HEADLINE DO CARD ===), "
            "palavras em destaque (=== PALAVRAS EM DESTAQUE ===) e descrição do visual.\n"
            "Gere um HTML completo e auto-contido (CSS inline, Google Fonts via @import).\n"
            "Retorne APENAS o HTML, começando com <!DOCTYPE html>."
        ),
    }
    return instructions.get(step_id, "Execute sua tarefa conforme seu guia operacional.")


# ─────────────────────────────────────────────
#  Anthropic SDK call (API key from .env)
# ─────────────────────────────────────────────

# Model mapping by agent model_tier
_MODEL_MAP = {
    "fast": "claude-haiku-4-5-20251001",
    "standard": "claude-sonnet-4-6",
    "powerful": "claude-opus-4-6",
}
_DEFAULT_MODEL = "claude-sonnet-4-6"


async def _call_claude_cli(
    system: str,
    user_message: str,
    on_token: Callable[[str], None] | None,
    web_search: bool = False,
    model_tier: str = "standard",
) -> str:
    """
    Calls the Anthropic API directly via the Python SDK using ANTHROPIC_API_KEY
    from webapp/.env. Never uses the CLI subprocess or terminal OAuth session.
    Streams response tokens to on_token as they arrive.
    """
    import anthropic

    if not ANTHROPIC_API_KEY:
        raise RuntimeError("ANTHROPIC_API_KEY não configurado em webapp/.env")

    client = anthropic.AsyncAnthropic(api_key=ANTHROPIC_API_KEY)
    model = _MODEL_MAP.get(model_tier, _DEFAULT_MODEL)

    tools = []
    if web_search:
        tools = [{"type": "web_search_20250305", "name": "web_search"}]

    kwargs: dict = {
        "model": model,
        "max_tokens": 8096,
        "system": system,
        "messages": [{"role": "user", "content": user_message}],
    }
    if tools:
        kwargs["tools"] = tools

    full_text = ""
    try:
        async with client.messages.stream(**kwargs) as stream:
            async for text in stream.text_stream:
                full_text += text
                if on_token:
                    on_token(text)
    except anthropic.APIStatusError as e:
        error_msg = f"[Anthropic API erro {e.status_code}: {e.message}]"
        if on_token:
            on_token(f"\n{error_msg}\n")
        return (full_text + f"\n{error_msg}").strip() if full_text else error_msg

    return full_text.strip()


# ─────────────────────────────────────────────
#  Output saving
# ─────────────────────────────────────────────

def _extract_html(content: str) -> str:
    """Extract only the HTML block from agent output, ignoring reasoning text."""
    import re
    # Try to find <!DOCTYPE html> ... </html> block
    match = re.search(r'(<!DOCTYPE\s+html[\s\S]*</html>)', content, re.IGNORECASE)
    if match:
        return match.group(1).strip()
    # Fallback: find <html> ... </html>
    match = re.search(r'(<html[\s\S]*</html>)', content, re.IGNORECASE)
    if match:
        return match.group(1).strip()
    return content


def _save_output(step_id: str, run_id: str, content: str, agent_id: str):
    from .config import STEP_OUTPUT_FILES
    output_files = STEP_OUTPUT_FILES.get(step_id, [])
    for rel_path in output_files:
        # For design HTML, extract only the HTML block from the raw agent output
        if rel_path.endswith(".html"):
            write_artifact(run_id, rel_path, _extract_html(content))
        else:
            write_artifact(run_id, rel_path, content)


def _patch_html_paths(html: str, run_id: str) -> str:
    """
    Replace relative logo paths with absolute file:// URLs so Playwright
    can load the logo regardless of how deep the run directory is.
    """
    import re as _re
    logo_abs = (PROJECT_ROOT / "_opensquad" / "assets" / "logo-doctorcreator.png").resolve()
    logo_url = f"file://{logo_abs}"
    # Replace any path ending in logo-doctorcreator.png (relative or absolute)
    html = _re.sub(
        r'["\']([^"\']*logo-doctorcreator\.png)["\']',
        f'"{logo_url}"',
        html,
    )
    return html


async def _render_card_to_jpg(run_id: str):
    """Use Playwright to render card.html to card.jpg."""
    run_dir = get_run_dir(run_id)
    html_path = run_dir / "design" / "card.html"
    jpg_path = run_dir / "design" / "card.jpg"

    if not html_path.exists():
        return

    # Patch logo paths before rendering
    original_html = html_path.read_text(encoding="utf-8")
    patched_html = _patch_html_paths(original_html, run_id)
    html_path.write_text(patched_html, encoding="utf-8")

    try:
        from playwright.async_api import async_playwright
        async with async_playwright() as p:
            browser = await p.chromium.launch()
            page = await browser.new_page()
            await page.set_viewport_size({"width": 1080, "height": 1350})
            await page.goto(f"file://{html_path.resolve()}")
            # Wait for fonts + background image to load
            await page.wait_for_timeout(2500)
            await page.screenshot(path=str(jpg_path), full_page=False)
            await browser.close()
        # Remove stale error file if render succeeded
        err_file = run_dir / "design" / "render-error.txt"
        if err_file.exists():
            err_file.unlink()
    except Exception as e:
        print(f"[designer] Playwright render failed: {e}")
        (run_dir / "design" / "render-error.txt").write_text(
            f"Render failed: {e}\nInstall Playwright: playwright install chromium"
        )


# ─────────────────────────────────────────────
#  Instagram publish (step-11)
# ─────────────────────────────────────────────

def _extract_caption(draft: str) -> str:
    """Extract the Instagram caption block from content-draft.md."""
    import re
    match = re.search(r'=== LEGENDA INSTAGRAM ===\s*\n(.*?)(?:\n===|\Z)', draft, re.DOTALL)
    if match:
        return match.group(1).strip()
    return ""


async def _execute_publish(run_id: str, on_token: Callable[[str], None] | None) -> str:
    """Execute the Instagram publish script for step-11. Does not call Claude."""
    import re
    from datetime import datetime, timezone

    run_dir = get_run_dir(run_id)
    env_path = PROJECT_ROOT / ".env"

    def emit(text: str):
        if on_token:
            on_token(text)

    # 1. Locate card.jpg
    card_jpg = run_dir / "design" / "card.jpg"
    if not card_jpg.exists():
        msg = (
            "❌ card.jpg não encontrado em design/\n\n"
            "O Marco Design precisa gerar e renderizar o card antes da publicação."
        )
        emit(msg)
        return f"# Relatório de Publicação\n\n**Status:** ERRO\n\n{msg}"

    # 2. Extract caption
    draft = read_artifact(run_id, "v1/content-draft.md")
    caption = _extract_caption(draft)
    if not caption:
        msg = (
            "❌ Legenda não encontrada em content-draft.md\n\n"
            "Verifique se o Carlos Cópia gerou a seção '=== LEGENDA INSTAGRAM ==='."
        )
        emit(msg)
        return f"# Relatório de Publicação\n\n**Status:** ERRO\n\n{msg}"

    caption = caption[:2200]

    # 3. Check Instagram credentials
    env_content = env_path.read_text(encoding="utf-8") if env_path.exists() else ""
    has_token = bool(re.search(r'INSTAGRAM_ACCESS_TOKEN=\S+', env_content))
    has_user = bool(re.search(r'INSTAGRAM_USER_ID=\S+', env_content))

    if not has_token or not has_user:
        missing = []
        if not has_token:
            missing.append("INSTAGRAM_ACCESS_TOKEN")
        if not has_user:
            missing.append("INSTAGRAM_USER_ID")
        msg = (
            f"❌ Credenciais do Instagram não configuradas: {', '.join(missing)}\n\n"
            f"Adicione em `.env` (raiz do projeto):\n"
            f"INSTAGRAM_ACCESS_TOKEN=seu_token\n"
            f"INSTAGRAM_USER_ID=seu_user_id\n\n"
            f"Consulte `skills/instagram-publisher/SKILL.md` para instruções."
        )
        emit(msg)
        return f"# Relatório de Publicação\n\n**Status:** CREDENCIAIS FALTANDO\n\n{msg}"

    # 4. Run publish script
    script_path = PROJECT_ROOT / "skills" / "instagram-publisher" / "scripts" / "publish.js"
    emit("📸 Enviando card para o Instagram...\n")

    try:
        proc = await asyncio.create_subprocess_exec(
            "node",
            f"--env-file={env_path}",
            str(script_path),
            "--images", str(card_jpg),
            "--caption", caption,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT,
            cwd=str(PROJECT_ROOT),
        )

        stdout_lines: list[str] = []
        async for line in proc.stdout:  # type: ignore[union-attr]
            text = line.decode("utf-8", errors="replace")
            stdout_lines.append(text)
            emit(text)

        await proc.wait()
        full_output = "".join(stdout_lines)

        if proc.returncode != 0:
            return (
                f"# Relatório de Publicação\n\n**Status:** ERRO (código {proc.returncode})\n\n"
                f"```\n{full_output}\n```"
            )

        # Parse post URL and ID from script output
        post_url = next(
            (line.split("URL:")[-1].strip() for line in stdout_lines if "URL:" in line), ""
        )
        post_id = next(
            (line.split("Post ID:")[-1].strip() for line in stdout_lines if "Post ID:" in line), ""
        )

        ts = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
        return (
            f"# Relatório de Publicação\n\n"
            f"**Status:** PUBLICADO ✅\n"
            f"**Data:** {ts}\n\n"
            f"## Post\n"
            f"- **Post ID:** {post_id}\n"
            f"- **URL:** {post_url}\n\n"
            f"## Card publicado\n"
            f"- `design/card.jpg`\n\n"
            f"## Log\n"
            f"```\n{full_output.strip()}\n```"
        )

    except FileNotFoundError:
        msg = "❌ Node.js não encontrado. Instale Node.js para publicar no Instagram."
        emit(msg)
        return f"# Relatório de Publicação\n\n**Status:** ERRO\n\n{msg}"

    except Exception as e:
        msg = f"❌ Erro inesperado: {e}"
        emit(msg)
        return f"# Relatório de Publicação\n\n**Status:** ERRO\n\n{msg}"


# ─────────────────────────────────────────────
#  Helpers
# ─────────────────────────────────────────────

def _read_project_file(rel_path: str) -> str:
    path = PROJECT_ROOT / rel_path
    if path.exists():
        return path.read_text(encoding="utf-8")
    path2 = SQUAD_ROOT / rel_path.replace(f"squads/{SQUAD_ROOT.name}/", "")
    if path2.exists():
        return path2.read_text(encoding="utf-8")
    return ""
