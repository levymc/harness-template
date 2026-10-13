---
status: accepted
date: 2026-10-13
---

# 0001 — Desenho do harness deste template

## Contexto

O template nasceu da análise de quatro repositórios trabalhados por agentes de IA. As
ideias boas convergiam (AGENTS.md fino, proibição com sensor, incidente que vira guarda,
memória versionada), e os defeitos também: regras duras só em prosa, skills copiadas em
até sete pastas de ferramenta e divergindo, memória append-only de centenas de KB sem
índice confiável, dezenas de subagentes de iniciativa única nunca aposentados, links de
bootstrap quebrados, e três sistemas de memória sem dizer qual manda.

## Decisão

1. `AGENTS.md` é a fonte canônica, curta e escrita à mão, com teto de linhas imposto
   por check. `CLAUDE.md` só importa o `AGENTS.md`.
2. Toda proibição tem um sensor (check, hook ou teste) listado em `docs/guardrails.md`,
   ou é declarada como gap ("revisão").
3. Memória em quatro tipos com lugares e vidas diferentes (`docs/memory/README.md`):
   fato com citação verificável, decisão em ADR, trabalho em andamento que morre ao
   fechar, procedimento em skill/hook/check.
4. Uma só memória: a auto-memória do Claude Code fica desligada.
5. Skills só em `.claude/skills`. Poucos subagentes, de escopo estreito, com `tools:`
   explícito. Uso medido em `.harness/usage.jsonl`.
6. Lição nova sobe a escada: teste → check/hook → linha de skill → fato de memória.
   Toda checagem nova é vista falhar antes de ser aceita.
7. O próprio harness tem testes (`scripts/harness/test/`), nos dois sentidos.

## Alternativas consideradas

- **Vault de memória externo, compartilhado entre projetos** — recusada: a memória do
  projeto tem de viajar com o código, ser revisada em PR e ser verificada contra ele.
  Um vault externo não sabe em que commit o fato valia.
- **Gerar regras para cada ferramenta (.cursor, .codex, copilot…)** — recusada por ora:
  toda cópia por ferramenta observada divergiu. Ferramentas que leem `AGENTS.md` já
  são atendidas. A regra `single-skill-source` impede as cópias.
- **Pasta de tasks permanente (uma por tarefa, para sempre)** — recusada: chegou a 634
  pastas num dos repositórios, ninguém relia. O git já é o histórico; a tarefa é
  destilada e apagada.
- **`decisions.md` único append-only** — recusada pelo mesmo motivo: 6.700 linhas.
- **Subagente revisor em toda mudança** — recusada: em estudo de 2026 um revisor extra
  piorou o resultado; o `verificador` roda checks, não opina.

## Consequências

- Todo agente encontra o estado do repo impresso no início da sessão (hook SessionStart).
- Fechar tarefa custa um passo a mais (destilar), e é isso que mantém a memória pequena.
- Os checks textuais são fracos por natureza (verificam forma, não comportamento): o
  que o código faz continua sendo trabalho de teste.

## Revisar quando

- se o índice da memória passar do teto com frequência mesmo após consolidação (o teto
  pode estar errado, ou a escada não está sendo usada);
- se `.harness/usage.jsonl` mostrar skill ou agente sem uso por 60 dias;
- se uma segunda ferramenta além do Claude Code passar a ser usada no dia a dia.
