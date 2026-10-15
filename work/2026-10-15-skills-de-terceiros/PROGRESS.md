### 2026-10-15 — tarefa aberta, plano aprovado
- decisão: lista curada + busca aberta só sugere; cópia em .claude/skills fixada por SHA + skills-lock.json; skills do template viajam no adopt.
- achado: file-guard bloqueou a gravação do plano fora do repo porque o caminho tinha um termo proibido.
- próximo passo: corrigir file-guard (skill licao), depois scripts/harness/skills.mjs.

### 2026-10-15 — implementado; todos os critérios com evidência
- file-guard: `insideRepo` só confere termo dentro do repo; teste novo em hooks.test.mjs; prove.mjs vermelho nos dois sentidos (sem o filtro e com o filtro sempre falso).
- scripts/harness/skills.mjs (add/verify/outdated/remove/list) + skills.test.mjs (14 testes, upstream git local). prove.mjs vermelho para: checagem de hash, normalização CRLF, recusa de ref não-SHA, isenção de prosa no check-claims.
- regra check-claims:third-party-skills + describe dos dois lados em check-claims.test.mjs; linha em docs/guardrails.md.
- skill buscar-skills; iniciar-projeto (etapa 7), adotar-harness (após entrevista), jardinagem; adopt.mjs leva script `skills` e cobra critério (adopt.test.mjs).
- ADR 0005, docs/harness.md "Skills de terceiros", AGENTS.md e template de AGENTS.md.
- ponta a ponta contra o GitHub real, num repo descartável no scratchpad: `skills add anthropics/skills skills/mcp-builder --ref dbd4588…` instalou 10 arquivos, verify/outdated/list ok, check-claims sem erro de skill.
- pre-push: install, lint, typecheck, build, test, harness:check, harness:test verdes (113 testes do harness).
- NÃO verificado: pnpm test:e2e — worktree sem .env (DATABASE_URL ausente); a mudança não toca src/. Qualidade da busca aberta (WebSearch) e outdated sob rate limit do GitHub.
- próximo passo: fechar a tarefa (skill fechar-tarefa) depois do PR, se o usuário pedir.
