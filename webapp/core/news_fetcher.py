"""
Fetches medical/AI news via DuckDuckGo News — no API key required.
Used by step-01 to pre-fetch articles before passing to Claude for ranking.
This avoids using Claude's web_search skill, saving API usage.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone


# Conjunto 1 — busca inicial
_SEARCH_QUERIES = [
    "tendência wellness bem-estar Brasil 2026",
    "novo produto bem-estar lançamento wellness 2026",
    "saúde mental bem-estar novidade pesquisa 2026",
    "hábito saudável pesquisa comportamento saúde 2026",
    "nutrição funcional alimentação saudável tendência 2026",
    "sono recuperação saúde novidade 2026",
    "medicamento tratamento aprovação saúde 2026",
    "startup saúde wellness inovação produto lançamento 2026",
    "inovação medicina tecnologia novidade 2026",
    "inteligência artificial saúde diagnóstico novidade 2026",
    "wearable tecnologia saúde lançamento 2026",
    "wellness health innovation launch 2026",
    "health technology startup product 2026",
]

# Conjunto 2 — usado no redo_search. Mesmas categorias (saúde, wellness, tech, inovação), ângulos diferentes.
_REDO_SEARCH_QUERIES = [
    "comportamento bem-estar rotina saudável estudo 2026",
    "movimento wellness longevidade biohacking 2026",
    "saúde preventiva autocuidado tendência 2026",
    "descoberta médica pesquisa clínica 2026",
    "microbioma intestinal gut health novidade 2026",
    "saúde feminina hormônios inovação 2026",
    "suplemento nutricional lançamento tendência 2026",
    "fitness academia treino tecnologia 2026",
    "medicina personalizada genômica inovação 2026",
    "IA diagnóstico imagem médica 2026",
    "telemedicina saúde digital plataforma 2026",
    "well-being mental health innovation 2026",
    "nutrition supplement wellness product 2026",
]


def fetch_news(research_period_days: int = 30, max_results: int = 80, redo: bool = False) -> str:
    """
    Fetches recent news articles and returns them as a formatted markdown block.
    redo=True uses a second set of queries to find different articles.
    """
    try:
        from ddgs import DDGS
    except ImportError:
        try:
            from duckduckgo_search import DDGS
        except ImportError:
            return "(ddgs não instalado — instale com: pip install ddgs)"

    queries = _REDO_SEARCH_QUERIES if redo else _SEARCH_QUERIES
    cutoff = datetime.now(timezone.utc) - timedelta(days=research_period_days)
    seen_urls: set[str] = set()
    articles: list[dict] = []

    with DDGS() as ddgs:
        for query in queries:
            if len(articles) >= max_results:
                break
            try:
                results = ddgs.news(
                    query,
                    max_results=8,
                    safesearch="off",
                )
                for r in results:
                    url = r.get("url", "")
                    if url in seen_urls:
                        continue
                    pub_date = r.get("date", "")
                    if pub_date:
                        try:
                            dt = datetime.fromisoformat(pub_date.replace("Z", "+00:00"))
                            if dt < cutoff:
                                continue
                        except ValueError:
                            pass
                    seen_urls.add(url)
                    articles.append({
                        "title": r.get("title", ""),
                        "body": r.get("body", ""),
                        "source": r.get("source", ""),
                        "url": url,
                        "date": pub_date,
                    })
            except Exception:
                continue

    if not articles:
        return "(Nenhuma notícia encontrada via DuckDuckGo)"

    lines = [
        f"## Notícias pré-buscadas ({len(articles)} artigos dos últimos {research_period_days} dias)\n",
        "Use estes artigos como base para seu ranking. Verifique as URLs antes de incluir no output.\n",
    ]
    for i, a in enumerate(articles, 1):
        lines.append(
            f"### {i}. {a['title']}\n"
            f"- **Fonte:** {a['source']}\n"
            f"- **Data:** {a['date']}\n"
            f"- **URL:** {a['url']}\n"
            f"- **Resumo:** {a['body']}\n"
        )

    return "\n".join(lines)
