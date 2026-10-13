---
name: inicializacao-do-projeto
description: Como e por que o harness-template nasceu em 2026-10-13 — origem, restrições do dono e o que o bootstrap ensinou
type: project
status: active
verified: 2026-10-13
citations:
  - path: harness.config.json
    anchor: '"template": true'
  - path: docs/decisions/0001-harness-do-template.md
    anchor: 'Vault de memória externo'
  - path: test/setup-app.ts
    anchor: "if (existsSync('.env'))"
---

Criado em 2026-10-13 a partir da análise do harness de quatro repositórios do dono
(três de trabalho e um pessoal), mais pesquisa externa sobre memória de agentes. Repo
privado em `github.com/levymc/harness-template`; o CI passou de ponta a ponta no 2º commit.

Restrições que o dono impôs na criação, e que valem para todo trabalho aqui:
- tudo em PT-BR; identificadores de código em inglês;
- `AGENTS.md` canônico, com o Claude Code como ferramenta (sem regras por ferramenta);
- memória independente do vault pessoal de notas do dono (ADR 0001);
- Sequelize, não Prisma (ADR 0003);
- nomes de organização nunca aparecem no repo: estão em `forbiddenTerms` por hash.

**Por quê:** essas escolhas vieram do dono, não do código, e não são óbvias ao ler o
repo. O bootstrap também mostrou o padrão que o harness existe para pegar: o primeiro CI
quebrou porque o e2e exigia um `.env` que só existia na máquina de quem rodou o setup.

**Como aplicar:** antes de propor reverter uma destas escolhas, leia a ADR
correspondente e pergunte ao dono. Merge na `main` só com pedido explícito, como
aconteceu no PR #1. Ver também [[nest12-esm-vitest]] e [[vitest-nao-compila-como-o-build]].
