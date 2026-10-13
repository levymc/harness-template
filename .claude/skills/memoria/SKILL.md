---
name: memoria
description: Ler, verificar, criar, atualizar e consolidar a memória do projeto em docs/memory. Use quando aprender algo não óbvio que valha para sessões futuras, quando o usuário pedir "lembre disso", antes de agir com base num fato da memória, ou quando o lint acusar teto ou citação morta.
---

# Memória do projeto

A memória é `docs/memory/` — e só ela. O formato e o porquê estão em
`docs/memory/README.md`; leia uma vez se ainda não leu nesta sessão.

## Antes de USAR um fato

1. Abra o arquivo, não confie só na linha do índice.
2. Confira as `citations`: o arquivo existe e o trecho ainda diz o que o fato afirma?
   `pnpm memory verify` lista os suspeitos (código citado mudou depois de `verified`).
3. Confirmado → `pnpm memory touch <slug>`. Contradito → corrija o fato (ou marque
   `superseded`) **antes** de seguir, e diga ao usuário o que mudou.

## Antes de SALVAR algo — o filtro

Salve só o que é **não óbvio e durável**. NÃO salve:

- o que se descobre lendo o código ou o `git log` (estrutura, quem mudou o quê);
- o que só importa nesta conversa (isso vai no `PROGRESS.md` da tarefa, em `work/`);
- decisão de arquitetura (isso é ADR em `docs/decisions/`);
- regra que pode virar check, hook ou teste — **suba a escada** (skill `licao`). Um
  fato é o último degrau, para o que nenhuma checagem consegue cobrir.

Procure antes um fato existente sobre o mesmo assunto (`docs/memory/MEMORY.md`, grep):
atualizar é melhor que duplicar.

## Para salvar

1. `pnpm memory new <slug> --type <gotcha|project|reference|feedback>`
2. Preencha: `description` que permita decidir relevância sem abrir o arquivo; fato em
   poucas linhas; `**Por quê:**` (o incidente); `**Como aplicar:**`; `citations` com
   `path` + `anchor` literal (gotcha/project/reference exigem; feedback não).
3. Ligue com `[[outro-slug]]` quando houver relação.
4. `pnpm memory index` e `pnpm memory lint`.

Tipos: **gotcha** = armadilha do código/stack; **project** = estado ou restrição do
projeto que o código não conta; **reference** = onde está algo fora do repo;
**feedback** = como o usuário quer que se trabalhe aqui.

## Consolidar (quando o lint acusar teto, ou na `jardinagem`)

- Dois fatos sobre o mesmo assunto → um só; o outro vira `superseded` com
  `superseded_by`.
- Fato que ganhou check/hook/teste → `superseded`, `superseded_by: check-claims:<id>`
  (ou o caminho do teste). A guarda substitui a prosa.
- Nunca apague um fato em silêncio. Nunca suba o teto em `harness.config.json` para
  passar: isso é decisão do usuário, numa ADR.
