# Memória do projeto

Esta pasta é **a** memória dos agentes neste repositório — a única. A auto-memória do
Claude Code fica desligada (`"autoMemoryEnabled": false` em `.claude/settings.json`)
porque mora numa pasta local da máquina, fora do git, e vira um segundo sistema que
ninguém revisa. Aqui tudo é versionado, revisado em PR e conferido por código.

O índice é [`MEMORY.md`](MEMORY.md), **gerado** — o hook SessionStart o injeta no início
de toda sessão. A skill `memoria` (`.claude/skills/memoria/SKILL.md`) é o manual de uso.

## Os quatro tipos de memória, e onde cada um mora

| Tipo | Onde | Vida |
|---|---|---|
| Fatos (semântica) | aqui, um por arquivo | renovado ao verificar; nunca apagado em silêncio — vira `superseded` |
| Decisões | [`docs/decisions/`](../decisions/README.md) | ADR; recusadas também ficam |
| Trabalho em andamento (episódica) | `work/<data>-<slug>/` | **morre ao fechar**, depois de destilada |
| Procedimentos | skills, hooks, checks | é para onde as lições devem migrar |

Misturar os tipos foi o defeito principal dos harnesses de onde este saiu: diário de
sessão tratado como conhecimento, decisão misturada com estado, e um arquivo único que
só crescia.

## Formato de um fato

```markdown
---
name: <slug igual ao nome do arquivo>
description: <uma linha que decide relevância sem abrir o arquivo>
type: gotcha | project | reference | feedback
status: active | superseded
verified: YYYY-MM-DD
superseded_by: <slug, ADR ou guarda>   # só quando superseded
citations:                               # obrigatório, exceto em feedback
  - path: caminho/do/arquivo
    anchor: '<trecho literal que precisa continuar existindo>'
---

<o fato, curto>

**Por quê:** <o incidente ou a razão>

**Como aplicar:** <o que fazer diferente>
```

## O que o código garante (`pnpm memory lint`, também dentro de `pnpm harness:check`)

- toda citação existe e o `anchor` ainda está no arquivo — senão o fato está mentindo;
- `**Por quê:**` e `**Como aplicar:**` presentes;
- `[[links]]` apontam para fatos que existem;
- tetos: fatos ativos e linhas por fato (`harness.config.json`);
- `MEMORY.md` igual ao que `pnpm memory index` geraria.

E o que ele **sinaliza sem reprovar** (`pnpm memory verify`, e no SessionStart): fatos
**suspeitos**, cujos arquivos citados mudaram no git depois de `verified`. Releia,
corrija ou confirme com `pnpm memory touch <slug>`.

## Inspirações

- Verificação na leitura com citações: [memória do GitHub Copilot](https://github.blog/ai-and-ml/github-copilot/building-an-agentic-memory-system-for-github-copilot/).
- Ritual de início/fim de sessão e estado em JSON: [Anthropic, harnesses para agentes longos](https://anthropic.com/engineering/effective-harnesses-for-long-running-agents).
- Um fato por arquivo, frontmatter com descrição para recall, índice enxuto: o formato da auto-memória do Claude Code — trazido para dentro do repositório.
