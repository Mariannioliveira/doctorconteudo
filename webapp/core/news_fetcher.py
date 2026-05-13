"""
Fetches medical/AI news via DuckDuckGo News — no API key required.
Used by step-01 to pre-fetch articles before passing to Claude for ranking.
This avoids using Claude's web_search skill, saving API usage.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone


# Conjunto 1 — busca inicial
_SEARCH_QUERIES = [
    # Wellness / bem-estar
    "tendência wellness bem-estar Brasil 2026",
    "novo produto bem-estar lançamento wellness 2026",
    "saúde mental bem-estar novidade pesquisa 2026",
    "hábito saudável pesquisa comportamento saúde 2026",
    "nutrição funcional alimentação saudável tendência 2026",
    "sono recuperação saúde novidade 2026",
    # Inovação / tecnologia
    "inovação medicina tecnologia novidade 2026",
    "inteligência artificial saúde diagnóstico novidade 2026",
    "wearable tecnologia saúde lançamento 2026",
    "startup saúde wellness inovação produto lançamento 2026",
    "health technology startup product 2026",
    # Saúde pública / regulatório / viral (captura Anvisa, vigilância, tendências sociais)
    "Anvisa alerta produto saúde Brasil",
    "vigilância sanitária contaminação produto Brasil",
    "saúde pública notícia Brasil semana",
    "medicina viral notícia Brasil médico",
    "Exame saúde wellness inovação Brasil notícia",
]

# Conjunto 2 — usado no redo_search. Mesmas categorias, ângulos diferentes.
_REDO_SEARCH_QUERIES = [
    # Wellness / bem-estar
    "comportamento bem-estar rotina saudável estudo 2026",
    "movimento wellness longevidade biohacking 2026",
    "saúde preventiva autocuidado tendência 2026",
    "microbioma intestinal gut health novidade 2026",
    "saúde feminina hormônios inovação 2026",
    "suplemento nutricional lançamento tendência 2026",
    # Inovação / tecnologia
    "fitness academia treino tecnologia 2026",
    "medicina personalizada genômica inovação 2026",
    "IA diagnóstico imagem médica 2026",
    "telemedicina saúde digital plataforma 2026",
    "well-being mental health innovation 2026",
    # Saúde pública / regulatório / viral
    "Anvisa medicamento aprovação Brasil 2026",
    "educação médica medicina Brasil notícia",
    "saúde viral tendência Brasil hoje",
    "regulação saúde SUS Brasil destaque",
]

# Páginas para scraping direto — captura manchetes em destaque que DuckDuckGo pode perder
_DIRECT_FETCH_URLS = [
    # G1
    "https://g1.globo.com/",
    "https://g1.globo.com/saude/",
    "https://g1.globo.com/ciencia-e-saude/",
    "https://g1.globo.com/bemestar/",
    # Exame
    "https://exame.com/",
    "https://exame.com/saude/",
    # NY Post (health & wellness section)
    "https://nypost.com/health/",
    "https://nypost.com/lifestyle/",
    # Metrópoles
    "https://www.metropoles.com/saude",
    "https://www.metropoles.com/vida-e-estilo",
]


_NAV_PHRASES = {
    "fale com", "assine", "ver mais", "see more", "leia mais", "saiba mais",
    "acesse", "baixe", "newsletter", "publicidade", "anuncie", "sobre nós",
    "contato", "privacidade", "política", "termos", "login", "cadastre",
}


def _scrape_site_headlines(url: str, max_articles: int = 8) -> list[dict]:
    """Fetch a news site page and extract article headlines + URLs via regex."""
    import re
    import html as _html
    import urllib.request
    from urllib.parse import urljoin

    try:
        req = urllib.request.Request(
            url,
            headers={"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36"},
        )
        with urllib.request.urlopen(req, timeout=12) as resp:
            raw = resp.read().decode("utf-8", errors="replace")
    except Exception:
        return []

    articles: list[dict] = []
    seen: set[str] = set()

    def _clean(text: str) -> str:
        text = _html.unescape(text)
        return re.sub(r'\s+', ' ', text).strip()

    def _is_nav(title: str) -> bool:
        low = title.lower()
        return any(phrase in low for phrase in _NAV_PHRASES) or title.isupper() or len(title.split()) < 4

    # Pattern 1: <a href="..."><tag>title</tag>
    for m in re.finditer(
        r'<a[^>]+href=["\']([^"\']{10,})["\'][^>]*>\s*<[^/][^>]*>\s*([^<]{20,300})\s*</',
        raw, re.DOTALL,
    ):
        link = m.group(1).strip()
        title = _clean(m.group(2))
        if not link.startswith("http"):
            link = urljoin(url, link)
        if link in seen or len(title) < 25 or _is_nav(title):
            continue
        seen.add(link)
        articles.append({"title": title, "body": "", "source": url, "url": link, "date": ""})
        if len(articles) >= max_articles:
            return articles

    # Pattern 2: direct text in <a href="...">title</a> (no nested tag)
    for m in re.finditer(
        r'<a[^>]+href=["\']([^"\']{10,})["\'][^>]*>([^<]{30,250})</a>',
        raw,
    ):
        link = m.group(1).strip()
        title = _clean(m.group(2))
        if not link.startswith("http"):
            link = urljoin(url, link)
        if link in seen or len(title) < 25 or _is_nav(title):
            continue
        seen.add(link)
        articles.append({"title": title, "body": "", "source": url, "url": link, "date": ""})
        if len(articles) >= max_articles:
            return articles

    return articles


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

    # ── Etapa 1: scraping direto dos sites de referência ──────────────────
    # Captura manchetes em destaque que o DuckDuckGo pode não indexar ainda
    for site_url in _DIRECT_FETCH_URLS:
        scraped = _scrape_site_headlines(site_url, max_articles=10)
        for a in scraped:
            if a["url"] not in seen_urls:
                seen_urls.add(a["url"])
                articles.append(a)

    # ── Etapa 2: buscas gerais via DuckDuckGo News ────────────────────────
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
