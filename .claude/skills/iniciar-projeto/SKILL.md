---
name: iniciar-projeto
description: Transforma uma cópia deste template num projeto novo — nome, memória de exemplo, primeira ADR, AGENTS.md do projeto. Use quando o usuário clonar ou copiar o harness-template para começar um projeto do zero.
---

# Iniciar projeto a partir do template

1. **Entreviste** (1–4 perguntas por rodada, nunca termine a sessão com pergunta): nome
   e propósito do projeto; se o esqueleto NestJS + Sequelize fica ou sai; quais termos
   nunca podem aparecer no repo (vão para `forbiddenTerms` via
   `node scripts/harness/check-claims.mjs --hash-term <termo>`); se o projeto terá
   deploy e como.
2. **Renomeie**: `package.json` (`name`, `description`), `README.md`.
3. **Memória**: os fatos de exemplo em `docs/memory/` são sobre ESTE template. Mantenha
   os que continuam verdade para o projeto novo (se o esqueleto ficou, os dois valem);
   apague os outros. `pnpm memory index`.
4. **ADRs**: mantenha 0001–0003 se continuam valendo; senão, marque `superseded`. A
   primeira ADR do projeto registra o propósito e as escolhas da etapa 1.
5. **AGENTS.md**: ajuste a seção do projeto **à mão, com o usuário**. Não gere com LLM
   a partir do código: arquivo de contexto gerado piora o resultado do agente (estudo
   ETH Zurich, 2026), e estrutura de diretórios o agente descobre sozinho.
6. Sem o esqueleto: apague `src/`, `test/`, `migrations/`, `scripts/db/`, configs de
   Nest/Vitest; desligue `no-sync` e `env-example` em `harness.config.json`; ajuste a
   skill `pre-push` e o CI para os comandos reais.
7. `pnpm check` verde, e o primeiro commit numa branch (o primeiro commit do repo
   pode ir na main; o hook permite).
