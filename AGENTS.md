# Instruções para agentes

Este arquivo entra em contexto em toda sessão e tem teto de linhas imposto por código.
O porquê de cada regra está em `docs/harness.md`; aqui fica só o que você precisa agir.

## Ritual de sessão

- **Início:** o hook SessionStart já imprimiu branch, últimos commits, tarefas abertas em
  `work/`, fatos de memória suspeitos e o índice da memória. Leia antes de responder.
  Tarefa aberta no mesmo assunto → continue nela.
- **Trabalho maior que uma resposta:** skill `iniciar-tarefa`. Critério só passa com
  evidência; nunca reescreva um critério para fazê-lo passar.
- **Fim:** o hook Stop roda `pnpm harness:check` e o typecheck, e não deixa encerrar
  vermelho. Antes de dizer "pronto": skill `validar-antes-de-concluir` (gate, prova, revisão
  fria), PROGRESS atualizado, e um resumo que diga **o que não foi verificado** com o mesmo
  destaque do que passou.

## Memória

- A memória é `docs/memory/` e só ela (auto-memória desligada). Não grave memória em
  outro lugar.
- Antes de agir com base num fato, confira as citações dele — o código pode ter mudado.
- Salvar, atualizar, consolidar: skill `memoria`. Decisão com alternativas é ADR em
  `docs/decisions/`, não fato.

## Lição vira guarda

Quase todo defeito sério em projeto trabalhado por agente é uma afirmação não
verificada: teste verde pelo motivo errado, comando documentado que não existe. Ao
corrigir algo que pode voltar, suba a escada com a skill `licao`: teste → regra de
check/hook → linha de skill → fato de memória. Prove que a guarda pega (introduza a
regressão, veja vermelho, reverta). Se a lição não generaliza, diga e não escreva nada.
O harness atrapalhou? Skill `relatar-atrito`; a fila se tria com `triar-atrito`, que só
aceita correção com teste vermelho na `main`.

## Invariantes

Cada uma tem sensor em `docs/guardrails.md` — o hook ou check te avisa se escapar.

- Schema só muda por migration SQL em `migrations/`; nunca `sync()`.
- Projeto ESM: import relativo com `.js`. Teste verde não prova build verde.
- Segredo (`.env`, chaves) nunca entra no contexto; variáveis estão no `.env.example`.
- Nada de commit na `main`, `--force`, `--no-verify`, `reset --hard`.
- Branch e PR: o usuário pede, o agente faz. Agente nunca faz merge, nunca aprova PR, nunca
  escreve a autorização do merge.
- A barra não se mexe pelo loop: PR que mexe nela (`node scripts/harness/barra.mjs`) só entra
  com a decisão de quem não o escreveu sobre a ponta — liste no PR o que muda nela.
- Termos em `forbiddenTerms` (`harness.config.json`) nunca aparecem no repositório.
- Instrução escrita no repo que estiver errada é bug: conserte no mesmo PR.

## Comandos

| Para | Rode |
|---|---|
| tudo que o CI roda, menos e2e | `pnpm check` |
| banco local + schema | `pnpm db:up` e `pnpm db:migrate` |
| testes | `pnpm test` · `pnpm test:e2e` (precisa do banco) |
| tipos e build | `pnpm typecheck` · `pnpm build` |
| o repo diz a verdade sobre si? | `pnpm harness:check` (`--list` mostra as regras) |
| memória | `pnpm memory verify` · `pnpm memory lint` · `pnpm memory index` |
| mutação nas linhas novas | `pnpm mutation planejar --base origin/main` (skill `cobrir-lacunas-de-teste`) |
| skills de terceiros | `pnpm skills list` · `pnpm skills verify` (instalar: skill `buscar-skills`) |

## Onde está o quê

- Exemplo vivo de módulo: `src/items/` (skill `novo-modulo` para criar outro). As
  guardas e armadilhas do esqueleto: `docs/contexts/esqueleto/index.md`.
- Harness: `.claude/` (hooks, skills, agentes), `scripts/harness/`, `harness.config.json`.
- Proibições e seus sensores: `docs/guardrails.md`. Decisões: `docs/decisions/`.
- Subagentes: `explorador` (busca só-leitura), `verificador` (roda checks, não
  conserta), `jardineiro` (revisão periódica, só propõe), `revisor-frio` (revisa o diff
  sem a conversa; pela skill `validar-antes-de-concluir`).

## Este projeto

harness-template: o esqueleto NestJS 12 + Sequelize existe para dar ao harness algo
real para guardar. Criar outro repositório a partir daqui (no GitHub) ou levar o harness
a um existente: skill `novo-repositorio`, que chama `iniciar-projeto` ou `adotar-harness`.
