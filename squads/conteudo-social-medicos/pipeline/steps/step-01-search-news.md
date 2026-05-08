---
step: "01"
name: "Pesquisa de Notícias"
type: agent
agent: pesquisador
depends_on: step-00
---

# Step 01: Dr. Scout — Pesquisa de Notícias

## Para o Pipeline Runner

Executar o Dr. Scout com **3 pilares de busca** para rastrear notícias de saúde, wellness, inovação e IA:

**Pilar 1 — Instagram como base:** ler `instagram-topics.md`, buscar notícias reais sobre os temas em alta nos perfis rastreados (pelo menos 3 buscas)

**Pilar 2 — Scraping dos sites de referência:** web_fetch direto em G1, Exame, Metropolitana e NY Post para extrair artigos recentes (pelo menos 4 fetches)

**Pilar 3 — Busca geral:** web_search com termos variados de saúde/wellness/inovação/IA na internet em geral (pelo menos 5 buscas)

Retornar 5-7 notícias ranqueadas que passem no filtro central (saúde/wellness/inovação/IA — excluir política, entretenimento, economia geral).

## Inputs — O runner DEVE ler e injetar no prompt do subagente

Antes de despachar o subagente, o pipeline runner deve:

1. Ler `squads/conteudo-social-medicos/_memory/seen-stories.json` e incluir o conteúdo completo no prompt como:
   ```
   === SEEN_STORIES (não repetir nenhuma dessas URLs) ===
   {conteúdo do arquivo}
   ===
   ```

2. Ler `squads/conteudo-social-medicos/_memory/instagram-topics.md` e incluir no prompt como:
   ```
   === INSTAGRAM_TOPICS (notícias dos perfis de referência) ===
   {conteúdo do arquivo}
   ===
   ```

3. Incluir `research_period` → período definido no Step 00 (7, 15 ou 30 dias)

**O subagente NÃO tem acesso a arquivos locais** — todo contexto deve ser injetado no prompt pelo runner. Nunca instruir o subagente a fazer web_fetch em arquivos locais.

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
