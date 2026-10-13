---
name: adotar-harness
description: Instala este harness (AGENTS.md, hooks, skills, memória, checks) num repositório JÁ EXISTENTE, sem sobrescrever nada, e conduz a arqueologia e a entrevista que preenchem o AGENTS.md. Use quando o usuário quiser levar o harness para um projeto antigo ou legado.
---

# Adotar o harness num projeto existente

Projeto antigo já tem convenções, comandos e armadilhas — que estão no código, no
`git log` e na cabeça do usuário, não num arquivo. O trabalho aqui é **descobrir e
confirmar**, não inventar.

## 1. Instalar a camada (mecânico)

A partir de uma cópia deste template:

```bash
node scripts/harness/adopt.mjs <caminho-do-projeto> --dry-run   # mostra o que faria
node scripts/harness/adopt.mjs <caminho-do-projeto>
```

O script copia só a camada de harness (lista em `harness.config.json` → `layer`),
**nunca sobrescreve** (conflito vira `<arquivo>.harness-proposto`), zera `forbiddenTerms`,
desliga as regras específicas do esqueleto, acrescenta os scripts `harness:*` e `memory`
ao `package.json` se não existirem, e abre a tarefa `work/<data>-adotar-harness/`.

## 2. Arqueologia (no projeto de destino; use o agente `explorador` para varrer)

- **Comandos reais**: `package.json`/`Makefile`/CI. Quais de fato rodam? Rode-os.
- **Instruções existentes**: CLAUDE.md, AGENTS.md, `.cursor/rules`, copilot-instructions,
  wikis. O que ainda é verdade? (O `cited-path` e o `pnpm-script` do check-claims
  respondem parte disso sozinhos.)
- **Incidentes**: `git log --grep "fix\|hotfix\|revert" --oneline | head -50`, issues de
  bug. Cada incidente recorrente é candidato a guarda (skill `licao`).
- **Cópias por ferramenta** de skills/regras: liste para consolidar numa fonte só.

## 3. Entrevista (1–4 perguntas por rodada)

Confirme com o usuário o que a arqueologia achou: invariantes, o que nunca pode
acontecer, branches protegidas, como se faz deploy, o que um agente não deve tocar.

## 4. Escrever, com o usuário

- `AGENTS.md`: substitua cada `<!-- pendente: … -->` — a regra `pending-markers`
  reprova enquanto sobrar algum. Curto: o teto vale aqui também.
- `docs/guardrails.md`: uma linha por proibição confirmada, com sensor ou "revisão".
- 3 a 5 fatos de memória com citação (skill `memoria`) — os mais caros de redescobrir.
- ADR 0001 do projeto: "adoção do harness", com o que foi recusado.
- Conflitos `.harness-proposto`: resolva um a um com o usuário e apague o proposto.

## 5. Fechar

`pnpm harness:check` verde (ou `node scripts/harness/check-claims.mjs` se o projeto não
usar pnpm), skill `fechar-tarefa`, e um resumo do que ficou como gap declarado.
