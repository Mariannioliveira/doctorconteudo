"""
Fetches medical/AI news via DuckDuckGo News — no API key required.
Used by step-01 to pre-fetch articles before passing to Claude for ranking.
This avoids using Claude's web_search skill, saving API usage.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone


_SEARCH_QUERIES = [
    "inteligência artificial medicina diagnóstico 2025 2026",
    "IA saúde médico inovação tecnologia",
    "medicina digital saúde tecnologia novidades",
    "CFM resolução médica regulamentação",
    "médico creator digital redes sociais tendências",
    "artificial intelligence medicine healthcare news",
    "medical AI diagnosis treatment breakthrough",
]


def fetch_news(research_period_days: int = 30, max_results: int = 40) -> str:
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
