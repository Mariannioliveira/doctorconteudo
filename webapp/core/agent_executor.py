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
        output = await _execute_publish(run_id, on_token, last_decision=last_decision)
        _save_output("step-08", run_id, output, "publicador")
        return output

    agent_id = step.get("agent", "")
    agent_meta, agent_body = load_agent_md(agent_id)

    # step-01: pre-fetch news externally so Claude only ranks, no web_search used
    prefetched_news = ""
    is_redo = False
    if step.get("id") == "step-01":
        from .news_fetcher import fetch_news
        period_days = _get_research_period(run_id)
        is_redo = (last_decision or {}).get("action") == "redo_search"
        prefetched_news = fetch_news(research_period_days=period_days, redo=is_redo)

    # Never pass web_search to Claude for step-01 — articles are pre-fetched
    skills = agent_meta.get("skills", [])
    has_web_search = "web_search" in skills and step.get("id") != "step-01"

    system_prompt = _build_system_prompt(agent_body, run_id)
    user_message = _build_user_message(step, run_id, last_decision)

    if prefetched_news:
        # No redo_search, inclui seen-stories para evitar repetição; em run fresco, só published.
        excluded = _load_excluded_story_urls(include_seen=is_redo)
        exclusion_note = ""
        if excluded:
            url_list = "\n".join(f"- {u}" for u in sorted(excluded))
            exclusion_note = (
                f"\n\n⚠️ URLs JÁ PUBLICADAS — prefira não incluir no output, mas inclua se não houver alternativas novas:\n{url_list}\n"
            )
        user_message = prefetched_news + exclusion_note + "\n\n---\n\n" + user_message

    model_tier = agent_meta.get("model_tier", "standard")
    output = await _call_claude_cli(
        system_prompt, user_message, on_token,
        web_search=has_web_search, model_tier=model_tier,
    )

    _save_output(step["id"], run_id, output, agent_id)

    if step["id"] == "step-06":
        await _generate_background_image(run_id)
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
        elif step_id == "step-06" and action in ("adjust_design", "request_changes"):
            if feedback:
                decision_context = (
                    f"\n**O usuário pediu este ajuste específico:** {feedback}\n\n"
                    "OBRIGATÓRIO: gere uma imagem COMPLETAMENTE DIFERENTE da anterior — "
                    "crie um novo prompt temático e use uma seed diferente. "
                    "Se o pedido menciona pessoa/paciente/humano, use os modificadores de qualidade: "
                    "`hyperrealistic, sharp focus, 8k uhd, professional photography, perfect face`.\n"
                )
            else:
                decision_context = (
                    "\n**O usuário solicitou ajuste no design.**\n"
                    "OBRIGATÓRIO: gere uma imagem COMPLETAMENTE DIFERENTE — novo prompt, nova seed. "
                    "Não reutilize a URL ou seed anterior.\n"
                )

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
            "Os artigos acima foram pré-buscados pelo sistema. SUA ÚNICA TAREFA é:\n"
            "1. Filtrar os artigos que passam no filtro central (saúde, wellness, inovação, IA — excluir política, entretenimento, economia geral)\n"
            "2. Excluir qualquer URL presente na lista de NOTÍCIAS JÁ MOSTRADAS\n"
            "3. Ranquear os artigos restantes do mais ao menos interessante\n"
            "4. Retornar os melhores 10 em formato YAML\n\n"
            "NÃO faça buscas adicionais. NÃO invente informações. Use apenas os artigos fornecidos acima.\n\n"
            "EXCLUIR obrigatoriamente do output:\n"
            "- Notícias sobre resultados financeiros, faturamento, lucros trimestrais ou anuais de empresas\n"
            "- Notícias sobre receita, projeção de receita, guidance financeiro\n"
            "- Relatórios de balanço ou earnings de empresas\n"
            "- Notícias puramente de negócios sem relação com saúde, wellness ou inovação em saúde\n\n"
            "Retorne APENAS o YAML abaixo, sem nenhum texto antes ou depois:\n"
            "```yaml\nranked_stories:\n  - rank: 1\n    title: \"Título completo\"\n"
            "    summary: \"2-3 frases objetivas\"\n"
            "    source: \"Nome do veículo\"\n"
            "    url: \"https://url-exata.com\"\n"
            "    date: \"YYYY-MM-DD\"\n"
            "    viral_potential_score: 7.5\n"
            "    category: \"wellness | saúde | inovação | startup | mercado | tecnologia | ia\"\n"
            "    why_interesting: \"Por que o público de saúde e wellness vai se importar\"\n"
            "    key_data: \"O dado mais forte da notícia\"\n"
            "```"
        ),
        "step-03": (
            "Crie o conteúdo completo para a card única no Instagram.\n"
            "Leia a notícia selecionada em selected-story.yaml e siga exatamente o seu Output Format.\n\n"
            "REGRA CRÍTICA DA HEADLINE: a headline DEVE ser o título real da notícia adaptado para "
            "português do Brasil em max 10 palavras — estilo manchete de jornal. "
            "Nunca invente, reinterprete ou crie ângulo próprio.\n\n"
            "REGRA CRÍTICA DA LEGENDA: escrever em prosa corrida, parágrafos curtos. "
            "PROIBIDO usar seções com título como 'Dados da notícia:', 'Dados e resultados:', 'Resumo:' etc. "
            "PROIBIDO usar listas com hífen. Os dados devem ser integrados naturalmente nos parágrafos.\n\n"
            "=== HEADLINE DO CARD ===\n"
            "[Título real da notícia — max 10 palavras, em português, manchete direta]\n\n"
            "=== PALAVRAS EM DESTAQUE (#92adff) ===\n"
            "[palavra1], [expressão2]\n\n"
            "=== DESCRIÇÃO DO VISUAL ===\n"
            "[Descrição da foto de fundo ideal]\n\n"
            "=== LEGENDA INSTAGRAM ===\n"
            "➡️ Siga @doctorcreatorwellness\n\n"
            "[Hook — frase forte]\n\n"
            "[Parágrafo 1 — o que aconteceu]\n\n"
            "[Parágrafo 2 — como funciona ou o mecanismo]\n\n"
            "[Parágrafo 3 — na prática, com dados integrados em prosa]\n\n"
            "[Parágrafo final — por que importa]\n\n"
            "(Fonte: [veículo])\n\n"
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
            "palavras em destaque (=== PALAVRAS EM DESTAQUE ===) e descrição do visual.\n\n"
            "IMPORTANTE sobre a imagem de fundo:\n"
            "- Use SEMPRE `./bg-image.jpg` como src do <img class='bg'>\n"
            "- NÃO use URLs externas (Pollinations, Unsplash, etc.)\n"
            "- A imagem é gerada automaticamente pelo sistema com Gemini antes do render\n\n"
            "Gere um HTML completo e auto-contido (CSS inline, Google Fonts via @import).\n"
            "Retorne APENAS o HTML, começando com <!DOCTYPE html>."
        ),
    }
    return instructions.get(step_id, "Execute sua tarefa conforme seu guia operacional.")


# ─────────────────────────────────────────────
#  Anthropic SDK call (API key from .env)
# ─────────────────────────────────────────────

# Model mapping by agent model_tier
# IMPORTANT: Opus is forbidden in this project. "powerful" uses Sonnet.
_MODEL_MAP = {
    "fast": "claude-haiku-4-5-20251001",
    "standard": "claude-sonnet-4-6",
    "powerful": "claude-sonnet-4-6",
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


def _filter_prefetched_news(prefetched: str, excluded_urls: set[str]) -> str:
    """Remove articles with excluded URLs from the pre-fetched news block before passing to Claude."""
    if not excluded_urls:
        return prefetched

    lines = prefetched.split("\n")
    result = []
    skip_article = False
    current_article_lines: list[str] = []

    for line in lines:
        # Article header (### N. Title)
        if line.startswith("### "):
            # Decide on previous article
            if current_article_lines:
                if not skip_article:
                    result.extend(current_article_lines)
            skip_article = False
            current_article_lines = [line]
        elif line.startswith("- **URL:**"):
            url = line.replace("- **URL:**", "").strip()
            if url in excluded_urls:
                skip_article = True
            current_article_lines.append(line)
        else:
            current_article_lines.append(line)

    # Last article
    if current_article_lines and not skip_article:
        result.extend(current_article_lines)

    filtered = "\n".join(result)
    # Update header count
    import re as _re
    new_count = len(_re.findall(r'^### \d+\.', filtered, _re.MULTILINE))
    filtered = _re.sub(r'## Notícias pré-buscadas \(\d+ artigos', f'## Notícias pré-buscadas ({new_count} artigos', filtered)
    return filtered


def _load_excluded_story_urls(include_seen: bool = False) -> set[str]:
    """Load URLs to exclude from step-01 ranking.
    always excludes used-stories.json (published); seen-stories.json only on redo_search."""
    import json as _json
    urls: set[str] = set()
    memory_dir = SQUAD_ROOT / "_memory"
    fnames = ["used-stories.json"]
    if include_seen:
        fnames.append("seen-stories.json")
    for fname in fnames:
        path = memory_dir / fname
        try:
            if path.exists():
                data = _json.loads(path.read_text(encoding="utf-8"))
                urls.update(entry.get("url", "") for entry in data if entry.get("url"))
        except Exception:
            pass
    return urls


def _save_output(step_id: str, run_id: str, content: str, agent_id: str):
    from .config import STEP_OUTPUT_FILES
    output_files = STEP_OUTPUT_FILES.get(step_id, [])
    for rel_path in output_files:
        # For design HTML, extract only the HTML block from the raw agent output
        if rel_path.endswith(".html"):
            write_artifact(run_id, rel_path, _extract_html(content))
        else:
            write_artifact(run_id, rel_path, content)


_GRADIENT = "linear-gradient(to top, rgba(0,0,0,1.0) 0%, rgba(0,0,0,0.95) 22%, rgba(0,0,0,0.6) 36%, rgba(0,0,0,0.15) 50%, rgba(0,0,0,0.0) 55%)"
_OVERLAY_CSS = f"  .overlay {{ position: absolute; inset: 0; z-index: 1; background: {_GRADIENT}; }}"
_OVERLAY_DIV = '<div class="overlay"></div>'

# Canonical design values enforced at render time regardless of what the agent wrote
_DESIGN_CSS_PATCHES = [
    (r'\.headline-block\s*\{[^}]*\}', '.headline-block { padding: 0 160px 128px; text-align: center; }'),
    (r'\bh1\s*\{[^}]*\}', 'h1 { font-size: 53px; font-weight: 800; color: #FFFFFF; line-height: 1.15; max-height: 260px; overflow: hidden; }'),
    (r'\.footer\s*\{[^}]*\}', '.footer { width: 100%; background: transparent; display: flex; align-items: center; justify-content: space-between; padding: 20px 48px 80px; }'),
    (r'\.footer-cta\s*\{[^}]*\}', '.footer-cta { font-size: 22px; font-weight: 400; color: #FFFFFF; letter-spacing: 0.12em; text-transform: uppercase; }'),
    (r'\.footer-arrow\s*\{[^}]*\}', '.footer-arrow { font-size: 36px; font-weight: 700; vertical-align: middle; }'),
    (r'\.subtitle\s*\{[^}]*\}', ''),  # remove any subtitle CSS
]


def _ensure_gradient_overlay(html: str) -> str:
    """Enforce gradient overlay and canonical design CSS values at render time."""
    import re as _re

    # Always replace the .overlay CSS rule with the authoritative strong gradient
    if ".overlay" in html:
        html = _re.sub(
            r'\.overlay\s*\{[^}]*\}',
            f'.overlay {{ position: absolute; inset: 0; z-index: 1; background: {_GRADIENT}; }}',
            html,
        )
    else:
        html = html.replace("</style>", f"\n{_OVERLAY_CSS}\n</style>", 1)

    # Ensure the overlay div is present in the body
    if _OVERLAY_DIV not in html:
        html = _re.sub(
            r'(<img[^>]+class=["\'][^"\']*\bbg\b[^"\']*["\'][^>]*>)',
            r'\1\n  ' + _OVERLAY_DIV,
            html,
        )
        if _OVERLAY_DIV not in html:
            html = _re.sub(r'(<body[^>]*>)', r'\1\n  ' + _OVERLAY_DIV, html, count=1)

    # Enforce canonical design values (font size, spacing, arrow, no subtitle)
    for pattern, replacement in _DESIGN_CSS_PATCHES:
        html = _re.sub(pattern, replacement, html)

    # Ensure .footer-arrow class exists in CSS (agent may omit it)
    if ".footer-arrow" not in html:
        html = html.replace("</style>", "  .footer-arrow { font-size: 36px; font-weight: 700; vertical-align: middle; }\n</style>", 1)

    # Remove any subtitle elements from the body
    html = _re.sub(r'<p[^>]*class=["\'][^"\']*subtitle[^"\']*["\'][^>]*>.*?</p>', '', html, flags=_re.DOTALL)

    return html


def _record_used_bg_url(run_id: str, url: str) -> None:
    """Append background image URL to squad _memory/used-bg-images.json."""
    import json as _json
    try:
        memory_dir = get_run_dir(run_id).parent.parent / "_memory"
        memory_dir.mkdir(parents=True, exist_ok=True)
        used_path = memory_dir / "used-bg-images.json"
        existing: list = []
        if used_path.exists():
            try:
                existing = _json.loads(used_path.read_text(encoding="utf-8"))
            except Exception:
                existing = []
        # Normalize URL: strip query params for dedup (same photo, different sizes)
        base_url = url.split("?")[0]
        if not any(e.get("base_url") == base_url for e in existing):
            existing.append({"url": url, "base_url": base_url})
            used_path.write_text(_json.dumps(existing, ensure_ascii=False, indent=2), encoding="utf-8")
    except Exception as e:
        print(f"[designer] failed to record used bg url: {e}")


def _patch_html_paths(html: str, run_id: str) -> str:
    """
    1. Copy the cropped logo into the run's design folder and rewrite logo refs.
    2. Download any external https:// background image to img-bg.jpg locally
       so Playwright (headless) doesn't get blocked by Unsplash/CDN restrictions.
    """
    import re as _re
    import shutil as _shutil
    import urllib.request as _urlreq

    run_dir = get_run_dir(run_id)
    design_dir = run_dir / "design"
    design_dir.mkdir(parents=True, exist_ok=True)

    # ── Logo ──────────────────────────────────────────────────────
    src_logo = PROJECT_ROOT / "_opensquad" / "assets" / "logo-doctorcreator-cropped.png"
    if not src_logo.exists():
        src_logo = PROJECT_ROOT / "_opensquad" / "assets" / "logo-doctorcreator.png"
    dst_logo = design_dir / "logo-doctorcreator.png"
    try:
        _shutil.copyfile(src_logo, dst_logo)
    except Exception as e:
        print(f"[designer] failed to copy logo: {e}")
    html = _re.sub(
        r'["\']([^"\']*logo-doctorcreator[^"\']*\.png)["\']',
        '"./logo-doctorcreator.png"',
        html,
    )

    # ── Background image: download external URL to local img-bg.jpg ──
    bg_match = _re.search(
        r'<img[^>]+class=["\'][^"\']*\bbg\b[^"\']*["\'][^>]+src=["\']([^"\']+)["\']',
        html,
    ) or _re.search(
        r'<img[^>]+src=["\']([^"\']+)["\'][^>]+class=["\'][^"\']*\bbg\b[^"\']*["\']',
        html,
    )
    if bg_match:
        bg_url = bg_match.group(1)
        if bg_url.startswith("http"):
            dst_bg = design_dir / "img-bg.jpg"
            # Always re-download so "ajustar imagem" picks a fresh photo
            try:
                req = _urlreq.Request(bg_url, headers={"User-Agent": "Mozilla/5.0"})
                with _urlreq.urlopen(req, timeout=15) as resp:
                    dst_bg.write_bytes(resp.read())
                print(f"[designer] downloaded background image → img-bg.jpg")
                # Record URL so agent avoids repeating it
                _record_used_bg_url(run_id, bg_url)
            except Exception as e:
                print(f"[designer] failed to download bg image: {e}")
            if dst_bg.exists():
                html = html.replace(f'"{bg_url}"', '"./img-bg.jpg"').replace(f"'{bg_url}'", '"./img-bg.jpg"')

    return html


def _build_image_prompt(headline: str, visual_desc: str) -> str:
    """Map headline keywords to a dramatic cinematic prompt for the card background."""
    # Use only headline for matching — visual_desc can be misleading
    text = headline.lower()

    themes = [
        # Medical conditions — most specific first
        (["câncer", "cancer", "tumor", "oncol", "leucemia", "melanoma"],
         "cancer cell 3D render glowing red pink tentacles dark background, dramatic microscopic view, ultra detailed scientific visualization"),
        (["coração", "cardíac", "cardio", "infarto", "cardiovascular", "artéria", "avc", "derrame"],
         "human heart anatomy glowing red arteries dark background, dramatic cinematic lighting, ultra detailed 3D medical render"),
        (["cérebro", "alzheimer", "demência", "parkinson", "neurológ"],
         "brain MRI scan glowing blue dark background, cinematic medical visualization, dramatic lighting, ultra detailed"),
        (["ambulância", "emergência", "urgência", "pronto-socorro", "resgate"],
         "ambulance rushing city night dramatic red blue lights rain street, cinematic photography, motion blur, photorealistic"),
        (["dna", "genétic", "biotech", "microscop", "bióps"],
         "DNA double helix glowing colorful dark background, cinematic ultra detailed 3D render"),
        # Technology / AI
        (["inteligência artificial", "ia detecta", "ia supera", "ia diagnos", "ia prevê", "robot", "machine learning"],
         "glowing neural network brain medical AI visualization, futuristic dark lab, neon blue cyan accents, ultra detailed 3D render"),
        # Sleep / recovery
        (["sono", "insônia", "sleep"],
         "person sleeping peacefully blue moonlight dramatic atmosphere, cinematic shallow depth of field, photorealistic"),
        # Fitness / movement
        (["fitness", "treino", "exercício", "atleta", "academia", "atividade física", "corrida", "musculação"],
         "athlete training dramatic gym dark motivational lighting, high contrast cinematic, photorealistic"),
        # Nutrition / food
        (["nutrição", "alimentação", "dieta", "superfoods", "gut", "intestin", "microbioma", "fibras"],
         "colorful superfoods ingredients dramatic flatlay dark slate background, macro cinematic overhead lighting, ultra detailed"),
        # Supplements
        (["suplemento", "vitamina", "proteína", "whey", "cápsula", "colágeno", "probiótico"],
         "glowing supplement capsules pills arranged artistically dark pharmaceutical background, dramatic macro lighting, cinematic"),
        # Mental health
        (["mental", "ansiedade", "emocional", "stress", "depressão"],
         "abstract mind brain waves glowing purple blue dark surreal cinematic, meditation silhouette dramatic"),
        # Wearables
        (["wearable", "smartwatch", "anel inteligente", "monitor", "sensor"],
         "sleek smartwatch glowing health metrics dark premium surface, macro cinematic shot, blue light trails"),
        # Skin / beauty / hormones
        (["pele", "dermat", "cosmét", "beleza", "skincare"],
         "glowing skin texture close up dark background, dramatic beauty macro photography, cinematic"),
        (["hormônio", "menopausa", "feminina", "saúde da mulher", "ciclo"],
         "flowers feminine botanical elements dark moody cinematic, soft dramatic shadows, editorial photography"),
        # Patches / transdermal
        (["patch", "transdérm", "adesivo"],
         "transdermal patch close up skin dark dramatic background, macro cinematic lighting, ultra detailed"),
        # Business / market / finance — wellness industry
        (["lucro", "líder", "trimestre", "receita", "bilhão", "milhão", "investimento", "ipo", "startup", "empresa", "mercado", "crescimento", "superam", "projeta"],
         "thriving wellness industry glowing growth chart upward trend dark background, dramatic cinematic corporate, premium aesthetic"),
        # Longevity / biohacking
        (["longevidade", "biohacking", "envelhecimento", "anti-aging"],
         "person arms wide open dramatic sunset silhouette cinematic golden light, photorealistic wide shot"),
        # General wellness
        (["wellness", "bem-estar"],
         "wellness lifestyle serene nature dramatic golden light cinematic, person silhouette peaceful, photorealistic"),
    ]

    for keywords, prompt_base in themes:
        if any(kw in text for kw in keywords):
            base = prompt_base
            break
    else:
        base = "dramatic abstract health wellness concept glowing dark background, cinematic photorealistic, ultra detailed"

    return (
        f"{base}, "
        "single scene full frame composition, centered subject, "
        "no split screen, no multiple panels, no collage, no before and after, no grid, no diptych, "
        "4K ultra HD, ultra high resolution, cinematic photorealistic, dramatic lighting, dark moody background, 8k uhd, sharp focus"
    )


async def _generate_background_image(run_id: str) -> None:
    """Generate bg-image.jpg using Gemini via image-generator skill (OpenRouter API)."""
    import re as _re

    run_dir = get_run_dir(run_id)
    design_dir = run_dir / "design"
    design_dir.mkdir(parents=True, exist_ok=True)
    output_path = design_dir / "bg-image.jpg"

    script_path = PROJECT_ROOT / "skills" / "image-generator" / "scripts" / "generate.py"
    if not script_path.exists():
        print(f"[designer] image-generator script not found: {script_path}")
        return

    # Extract visual description and headline from content-draft.md
    draft = read_artifact(run_id, "v1/content-draft.md") or ""

    visual_desc = ""
    m = _re.search(r'=== DESCRIÇÃO DO VISUAL ===\s*\n(.+?)(?:\n===|\Z)', draft, _re.DOTALL)
    if m:
        visual_desc = m.group(1).strip().split("\n")[0].strip()

    headline = ""
    h = _re.search(r'=== HEADLINE DO CARD ===\s*\n(.+)', draft)
    if h:
        headline = h.group(1).strip()

    # Usa visual_desc do agente como base; acrescenta realismo e composição padrão.
    base = visual_desc if visual_desc else _build_image_prompt(headline, "")
    prompt = (
        f"{base}, "
        "photorealistic photography, real photo, no illustrations, no digital art, no painting, "
        "single scene full frame composition, centered subject, "
        "no split screen, no multiple panels, no collage, no before and after, no grid, no diptych, "
        "4K ultra HD, cinematic lighting, dark moody background, 8k uhd, sharp focus"
    )

    print(f"[designer] Generating background image: {prompt[:80]}...")
    try:
        proc = await asyncio.create_subprocess_exec(
            "python3", str(script_path),
            "--prompt", prompt,
            "--output", str(output_path),
            "--mode", "production",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            cwd=str(PROJECT_ROOT),
        )
        try:
            stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=120)
            if proc.returncode == 0:
                print(f"[designer] bg-image.jpg generated ({output_path.stat().st_size // 1024} KB)")
            else:
                print(f"[designer] image-generator failed: {stderr.decode()[:200]}")
        except asyncio.TimeoutError:
            proc.kill()
            print("[designer] image-generator timed out after 120s")
    except Exception as e:
        print(f"[designer] Failed to generate background image: {e}")


async def _render_card_to_jpg(run_id: str):
    """Use Playwright to render card.html to card.jpg."""
    run_dir = get_run_dir(run_id)
    html_path = run_dir / "design" / "card.html"
    jpg_path = run_dir / "design" / "card.jpg"

    if not html_path.exists():
        return

    # Patch logo paths and ensure gradient overlay before rendering
    original_html = html_path.read_text(encoding="utf-8")
    patched_html = _patch_html_paths(original_html, run_id)
    patched_html = _ensure_gradient_overlay(patched_html)
    html_path.write_text(patched_html, encoding="utf-8")

    try:
        import http.server
        import threading
        import urllib.parse as _urlparse

        design_dir = html_path.parent
        port = 0  # OS picks a free port

        class _Handler(http.server.SimpleHTTPRequestHandler):
            def __init__(self, *a, **kw):
                super().__init__(*a, directory=str(design_dir), **kw)
            def log_message(self, *_):
                pass

        httpd = http.server.HTTPServer(("127.0.0.1", port), _Handler)
        port = httpd.server_address[1]
        thread = threading.Thread(target=httpd.serve_forever, daemon=True)
        thread.start()

        from playwright.async_api import async_playwright
        async with async_playwright() as p:
            browser = await p.chromium.launch()
            page = await browser.new_page()
            await page.set_viewport_size({"width": 1080, "height": 1350})
            await page.goto(f"http://127.0.0.1:{port}/card.html")
            # Wait for fonts + background image to load
            await page.wait_for_timeout(2500)
            await page.screenshot(path=str(jpg_path), full_page=False)
            await browser.close()

        httpd.shutdown()
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
    if not match:
        return ""
    caption = match.group(1).strip()
    # Remove trailing code fences that Claude sometimes appends
    caption = re.sub(r'\n?```\s*$', '', caption).strip()
    return caption


async def _execute_publish(
    run_id: str,
    on_token: Callable[[str], None] | None,
    last_decision: dict | None = None,
) -> str:
    """Execute the Instagram publish script for step-08. Does not call Claude."""
    import re
    from datetime import datetime, timezone

    # If user chose to schedule, save to scheduler instead of publishing now
    if last_decision and last_decision.get("action") == "schedule":
        value = last_decision.get("value") or {}
        scheduled_time = value.get("scheduled_time", "") if isinstance(value, dict) else str(value)
        return await _save_to_scheduler(run_id, scheduled_time, on_token)

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
            limit=2 ** 20,  # 1MB — evita LimitOverrunError em respostas de erro longas
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


async def _save_to_scheduler(run_id: str, scheduled_time: str, on_token: Callable[[str], None] | None) -> str:
    """Save post data to the scheduler store instead of publishing immediately."""
    from datetime import datetime, timezone
    from .scheduled_posts import add as add_scheduled

    def emit(text: str):
        if on_token:
            on_token(text)

    run_dir = get_run_dir(run_id)
    card_jpg = run_dir / "design" / "card.jpg"

    if not card_jpg.exists():
        msg = "❌ card.jpg não encontrado — não é possível agendar."
        emit(msg)
        return f"# Agendamento\n\n**Status:** ERRO\n\n{msg}"

    draft = read_artifact(run_id, "v1/content-draft.md")
    caption = _extract_caption(draft)[:2200] if draft else ""
    if not caption:
        msg = "❌ Legenda não encontrada — não é possível agendar."
        emit(msg)
        return f"# Agendamento\n\n**Status:** ERRO\n\n{msg}"

    try:
        dt = datetime.fromisoformat(scheduled_time)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        scheduled_iso = dt.isoformat()
        scheduled_display = dt.strftime("%d/%m/%Y às %H:%M")
    except Exception:
        scheduled_iso = scheduled_time
        scheduled_display = scheduled_time

    # squad name is the grandparent of the run's output dir: squads/{squad}/output/{run_id}
    squad_name = run_dir.parent.parent.name

    post = add_scheduled(
        squad_name=squad_name,
        run_id=run_id,
        image_path=str(card_jpg.resolve()),
        caption=caption,
        scheduled_time=scheduled_iso,
    )

    emit(f"📅 Post agendado para {scheduled_display}\n")

    ts = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    return (
        f"# Relatório de Agendamento\n\n"
        f"**Status:** AGENDADO ✅\n"
        f"**Agendado para:** {scheduled_display}\n"
        f"**Criado em:** {ts}\n\n"
        f"## Post\n"
        f"- **ID:** {post['id']}\n"
        f"- **Card:** `design/card.jpg`\n\n"
        f"O post será publicado automaticamente no horário programado."
    )


async def _execute_scheduled_post(
    image_path: str,
    caption: str,
    run_id: str,
    on_token: Callable[[str], None] | None = None,
) -> str:
    """Called by the scheduler to publish a previously scheduled post."""
    import re
    from datetime import datetime, timezone

    env_path = PROJECT_ROOT / ".env"

    def emit(text: str):
        if on_token:
            on_token(text)

    env_content = env_path.read_text(encoding="utf-8") if env_path.exists() else ""
    has_token = bool(re.search(r"INSTAGRAM_ACCESS_TOKEN=\S+", env_content))
    has_user = bool(re.search(r"INSTAGRAM_USER_ID=\S+", env_content))

    if not has_token or not has_user:
        missing = [k for k, ok in [("INSTAGRAM_ACCESS_TOKEN", has_token), ("INSTAGRAM_USER_ID", has_user)] if not ok]
        return f"# Publicação\n\n**Status:** CREDENCIAIS FALTANDO\n\nFaltam: {', '.join(missing)}"

    script_path = PROJECT_ROOT / "skills" / "instagram-publisher" / "scripts" / "publish.js"
    emit("📸 Publicando post agendado...\n")

    try:
        proc = await asyncio.create_subprocess_exec(
            "node",
            f"--env-file={env_path}",
            str(script_path),
            "--images", image_path,
            "--caption", caption[:2200],
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT,
            cwd=str(PROJECT_ROOT),
            limit=2 ** 20,
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

        post_url = next((l.split("URL:")[-1].strip() for l in stdout_lines if "URL:" in l), "")
        post_id_val = next((l.split("Post ID:")[-1].strip() for l in stdout_lines if "Post ID:" in l), "")

        ts = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
        return (
            f"# Relatório de Publicação\n\n"
            f"**Status:** PUBLICADO ✅\n"
            f"**Data:** {ts}\n\n"
            f"## Post\n"
            f"- **Post ID:** {post_id_val}\n"
            f"- **URL:** {post_url}\n\n"
            f"## Log\n"
            f"```\n{full_output.strip()}\n```"
        )

    except FileNotFoundError:
        return "# Publicação\n\n**Status:** ERRO\n\nNode.js não encontrado."
    except Exception as e:
        return f"# Publicação\n\n**Status:** ERRO\n\n{e}"


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
