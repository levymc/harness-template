# Instruções para agentes

Este arquivo entra em contexto em toda sessão e tem teto de linhas imposto por código.
O porquê de cada regra está em `docs/harness.md`; aqui fica só o que você precisa agir.

## Ritual de sessão

- **Início:** o hook SessionStart já imprimiu branch, últimos commits, tarefas abertas em
  `work/`, fatos de memória suspeitos e o índice da memória. Leia antes de responder.
  Tarefa aberta no mesmo assunto → continue nela.
- **Trabalho maior que uma resposta:** skill `iniciar-tarefa`. Critério só passa com
  evidência; nunca reescreva um critério para fazê-lo passar.
- **Fim:** o hook Stop roda o check-claims e não deixa encerrar vermelho. Antes de dizer
  "pronto": skill `pre-push`, PROGRESS atualizado, e um resumo que diga **o que não foi
  verificado** com o mesmo destaque do que passou.

## Memória

- A memória é `docs/memory/` e só ela (auto-memória desligada). Não grave memória em
  outro lugar.
- Antes de agir com base num fato, confira as citações dele — o código pode ter mudado.
- Salvar, atualizar, consolidar: skill `memoria`. Decisão com alternativas é ADR em
  `docs/decisions/`, não fato.

## Lição vira guarda

Ao corrigir algo que pode voltar, suba a escada com a skill `licao`: teste → regra de
check/hook → linha de skill → fato de memória. Prove que a guarda pega. Se a lição não
generaliza, diga e não escreva nada.

## Invariantes

Cada uma tem sensor em `docs/guardrails.md`.

- Nada de commit na branch protegida, `--force`, `--no-verify`, `reset --hard`.
- Segredo (`.env`, chaves) nunca entra no contexto.
- Branch e PR: o usuário pede, o agente faz. Agente nunca faz merge.
- Instrução escrita no repo que estiver errada é bug: conserte no mesmo PR.
<!-- pendente: invariantes do projeto, confirmadas com o usuário (skill adotar-harness) -->

## Comandos

<!-- pendente: tabela "Para | Rode" só com comandos que você rodou e viu funcionar -->

## Onde está o quê

- Harness: `.claude/` (hooks, skills, agentes), `scripts/harness/`, `harness.config.json`.
- Proibições e seus sensores: `docs/guardrails.md`. Decisões: `docs/decisions/`.
<!-- pendente: as 3–6 entradas do projeto que um agente novo levaria mais tempo para achar -->

## Este projeto

<!-- pendente: o que é o projeto, em 2–4 linhas, nas palavras do usuário -->
