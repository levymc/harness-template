# harness-template

Template de **harness** para projetos trabalhados com agentes de IA (Claude Code e
qualquer ferramenta que leia `AGENTS.md`). O foco é *como* os agentes trabalham num
repositório — ritual de sessão, memória, guardas, lições que viram checagem — e não o
app. O esqueleto NestJS 12 + Sequelize existe para o harness ter algo real para guardar.

## O que vem pronto

- **`AGENTS.md` curto e escrito à mão**, com teto de linhas imposto por código.
- **Hooks** (`.claude/hooks/`): o estado do repositório e o índice da memória impressos
  no início de toda sessão; bloqueio de ação destrutiva, de segredo e de termo proibido;
  checagem antes de o agente encerrar; registro de uso de skills e agentes.
- **Memória que não mente** (`docs/memory/`): um fato por arquivo, com citações ao código
  verificadas por script, índice gerado, tetos, e fatos marcados como suspeitos quando o
  código citado muda. Decisões em ADR (`docs/decisions/`), trabalho em andamento em
  `work/` (apagado ao fechar, depois de destilado).
- **`check-claims`**: 17 regras para o repositório não afirmar sobre si o que não é
  verdade — caminhos, scripts e flags citados, frontmatter de skills e agentes,
  sensores de cada proibição, links, memória.
- **`prove.mjs`**: aplica uma regressão de propósito e confirma que a verificação fica
  vermelha. Uma checagem nunca vista falhar é decoração.
- **Skills** para memória, tarefas, lições, pre-push, adoção, novo módulo e jardinagem;
  **3 subagentes** de escopo estreito.
- **Testes do próprio harness** (`pnpm harness:test`), nos dois sentidos.

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
- [`docs/decisions/`](docs/decisions/README.md) — decisões, inclusive as recusadas.
- [`docs/contexts/esqueleto/index.md`](docs/contexts/esqueleto/index.md) — o app de exemplo e o que ele já ensinou.
