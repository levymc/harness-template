# harness-template

Template de **harness** para projetos trabalhados com agentes de IA (Claude Code e
qualquer ferramenta que leia `AGENTS.md`). O foco é *como* os agentes trabalham num
repositório — ritual de sessão, memória, guardas, lições que viram checagem — e não o
app. O esqueleto NestJS 12 + Sequelize existe para o harness ter algo real para guardar.

## O que vem pronto

- **`AGENTS.md` curto e escrito à mão**, com teto de linhas imposto por código.
- **Memória que não mente** (`docs/memory/`): um fato por arquivo, com citações ao código
  verificadas por script, índice gerado, tetos, e fatos marcados como suspeitos quando o
  código citado muda. Decisões em ADR (`docs/decisions/`), trabalho em andamento em
  `work/` (apagado ao fechar, depois de destilado).
- **Hooks** (`.claude/hooks/`): o estado do repositório e o índice da memória no início de
  toda sessão; checagem antes de o agente encerrar; registro de uso. Os guardas de ação
  delegam a um **motor de regras com prova** (`scripts/harness/rules/`, `docs/regras.md`):
  cada regra traz os casos que barra e os vizinhos que deixa passar, e o guarda que quebra
  barra em vez de deixar passar.
- **`check-claims`**: o repositório não afirma sobre si o que não é verdade — caminhos,
  scripts e flags citados, frontmatter de skills e agentes, sensores de cada proibição,
  links, memória, evidência dos critérios de tarefa, a página HTML.
- **Prova antes do "pronto"** (skill `validar-antes-de-concluir`): gate inteiro, parada na
  segunda falha igual, revisão em contexto frio por um subagente sem a conversa
  (`revisor-frio`), e **mutação** nas linhas novas de cada PR (Stryker, workflow `mutacao`).
- **`prove.mjs`**: aplica uma regressão de propósito e confirma que a verificação fica
  vermelha. Uma checagem nunca vista falhar é decoração.
- **O loop de melhoria**: atrito relatado com o trecho literal da sessão (`relatar-atrito`,
  issues com label `atrito`), triagem que só aceita correção com teste vermelho na `main`
  (`triar-atrito`), auditoria do ritual numa sessão real, e medição de maturidade
  (`achar-o-proximo-degrau`).
- **A barra**: o loop muda como o harness trabalha, nunca a régua que o julga sem a decisão de
  outra pessoa sobre o último commit do PR (`scripts/harness/barra.mjs`, workflow `fluxo`,
  ADR 0007).
- **Testes do próprio harness** (`pnpm harness:test`), nos dois sentidos, com a Temp limpa e
  teto de RAM.

## Começar

```bash
pnpm install
cp .env.example .env
pnpm db:up
pnpm db:migrate
pnpm check
pnpm test:e2e
```

Abra o Claude Code na pasta: o hook SessionStart mostra o estado e a memória.

- **Repositório novo no GitHub, ou harness num repositório existente:** peça ao Claude
  com a skill `novo-repositorio` (pergunta objetivo, dono, nome e visibilidade).
- **Projeto novo a partir daqui:** skill `iniciar-projeto`.
- **Levar o harness a um projeto existente:**
  `node scripts/harness/adopt.mjs <caminho> --dry-run`, depois sem `--dry-run`, depois a
  skill `adotar-harness` no projeto de destino. Nada é sobrescrito.

## Onde ler mais

- [`docs/harness-template.html`](docs/harness-template.html) — visão geral visual, numa página.
- [`docs/harness.md`](docs/harness.md) — o porquê de cada peça.
- [`docs/memory/README.md`](docs/memory/README.md) — o desenho da memória.
- [`docs/guardrails.md`](docs/guardrails.md) — toda proibição e o sensor que a impõe.
- [`docs/regras.md`](docs/regras.md) — as regras de ação do agente e o que fazer quando barram.
- [`docs/gastar-menos-uso.md`](docs/gastar-menos-uso.md) — sessões curtas, compactação e modelo: onde vai o uso.
- [`docs/decisions/`](docs/decisions/README.md) — decisões, inclusive as recusadas.
- [`docs/contexts/esqueleto/index.md`](docs/contexts/esqueleto/index.md) — o app de exemplo e o que ele já ensinou.
