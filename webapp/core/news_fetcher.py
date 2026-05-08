"""
Fetches medical/AI news via DuckDuckGo News — no API key required.
Used by step-01 to pre-fetch articles before passing to Claude for ranking.
This avoids using Claude's web_search skill, saving API usage.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone


_SEARCH_QUERIES = [
    # Wellness puro
    "tendência wellness bem-estar Brasil 2026",
    "novo produto bem-estar lançamento marca wellness 2026",
    "saúde mental bem-estar emocional novidade 2026",
    # Saúde comportamento e medicina
    "saúde comportamento hábito saudável pesquisa 2026",
    "nutrição funcional alimentação saudável tendência 2026",
    "sono recuperação saúde pesquisa novidade 2026",
    # Inovação e mercado
    "startup saúde wellness inovação lançamento 2026",
    "mercado wellness suplementos crescimento tendência 2026",
    "inovação medicina tratamento lançamento 2026",
    # Tecnologia e IA
    "inteligência artificial saúde diagnóstico 2026",
    "wearable tecnologia saúde lançamento 2026",
    # Internacional
    "wellness trend health innovation 2026",
    "health startup launch product 2026",
]


def fetch_news(research_period_days: int = 30, max_results: int = 80) -> str:
    """
    Fetches recent medical/AI news articles and returns them as a formatted
    markdown block ready to be injected into the researcher agent's prompt.
    """
    try:
        from ddgs import DDGS
    except ImportError:
        try:
            from duckduckgo_search import DDGS
        except ImportError:
            return "(ddgs não instalado — instale com: pip install ddgs)"

    cutoff = datetime.now(timezone.utc) - timedelta(days=research_period_days)
    seen_urls: set[str] = set()
    articles: list[dict] = []

    with DDGS() as ddgs:
        for query in _SEARCH_QUERIES:
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
                    # Filter by date if available
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
