---
step: "01"
name: "Pesquisa de Notícias"
type: agent
agent: pesquisador
depends_on: step-00
---

# Step 01: Dr. Scout — Pesquisa de Notícias Médicas

## Para o Pipeline Runner

Executar o Dr. Scout para rastrear as notícias mais relevantes de medicina e tecnologia na saúde das últimas 2-4 semanas.

O Pesquisador deve fazer **pelo menos 4 buscas** com ângulos diferentes e retornar as 5-7 notícias com maior potencial de engajamento para o público da Doctor Creator (médicos que buscam autoridade digital).

## Inputs

- `research_period` → período de busca definido no Step 00 (7, 15 ou 30 dias) — usar para filtrar notícias e configurar os filtros de data nas buscas
- `_opensquad/_memory/company.md` → contexto da Doctor Creator e público-alvo
- `_opensquad/_memory/preferences.md` → idioma de output

## Expected Output

- `output/ranked-stories.yaml` → 5-7 notícias ranqueadas com título, resumo, fonte, URL, data, viral_potential_score e why_interesting

## Execution Mode

- **Modo:** Subagente (roda em background)
- **Skills:** web_search, web_fetch

## Quality Gate

Antes de avançar para o Step 02:
- [ ] ranked-stories.yaml existe e é válido
- [ ] Contém entre 5 e 7 notícias
- [ ] Cada notícia tem: title, summary, source, url, date, viral_potential_score, why_interesting, key_data
- [ ] Todas as URLs foram verificadas (acessíveis)
- [ ] No máximo 2 notícias do mesmo veículo
- [ ] Notícias são de no máximo 60 dias atrás
