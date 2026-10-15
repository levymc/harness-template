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

### 2026-10-15 — buscar-skills rodada no template
- instalada (aprovada pelo usuário): skill-creator, anthropics/skills@dbd4588 (curada, Apache-2.0). Revisão linha a linha sem conteúdo hostil. Ressalvas: scripts de eval exigem Python e quebram no Windows (select em pipe); loop de descrição faz centenas de `claude -p`; run_eval grava temporário em .claude/commands/; generate_review mata processo na porta 3117 e embute todo arquivo de outputs/ no HTML → `.claude/skills/*-workspace/` no .gitignore (template e adopt).
- recusada: nestjs-expert (jeffallan/claude-skills@4f994f0, fora da lista) — ensina TypeORM, Jest, imports sem .js e npm; gatilho disputa com novo-modulo.
- recusada: supabase-postgres-best-practices (supabase/agent-skills@c9be0e9, fora da lista) — conteúdo limpo e 90% Postgres genérico, mas description agressiva cita "declarative schema" e RLS/auth.uid(), e traz `alter system`/DDL solto sem lembrar a regra "schema só por migration"; skill travada não se edita para pôr a ressalva.
- não há skill oficial de NestJS, Sequelize ou Vitest (busca aberta 2026-10-15).
- defeitos achados e corrigidos com teste + prove.mjs: parser de frontmatter não lia `description: |-`; adopt levava no lock skill excluída da camada (lockDaCamada); skill-frontmatter lia o disco e acusaria cópias de SKILL.md em workspace gitignored (agora usa os arquivos do repo).
- pnpm check e build verdes; adopt --dry-run leva os 18 arquivos da skill-creator.

### 2026-10-15 — nestjs-expert instalada a pedido explícito do usuário
- antes recusada (ver entrada anterior); o usuário pediu "adicione a nestjs-expert" — aprovação nomeada de fonte fora da lista. Instalada em jeffallan/claude-skills@4f994f0 (o SHA revisado; HEAD ainda era esse), trusted:false.
- em layerExclude: é do esqueleto NestJS, não viaja para projetos adotados (o adopt filtra o lock — lockDaCamada).
- ressalva escrita em docs/contexts/esqueleto/index.md: stack do projeto vence (Sequelize, Vitest, .js, pnpm, migration); módulo novo é com novo-modulo.
- adopt.test ajustado: o lock adotado é o do template menos as skills fora da camada. pnpm check verde (117 testes do harness).

### 2026-10-15 — buscar-skills ganha o modo objetivo
- pedido: "Utilizando a skill de buscar skills, me ajude a procurar skills que me ajudem em <objetivo>".
- etapa 1 agora escolhe modo repositório ou modo objetivo; o modo objetivo decompõe em capacidades, marca o que skill local já cobre, busca por capacidade (fornecedor oficial antes da busca aberta), ranqueia (frequência, conhecimento que o modelo não tem, compatibilidade, custo) e declara lacunas; estudo vai para work/<data>-<slug>/estudo-skills.md. Projeto futuro: recomenda, instala no derivado.
- caso de exemplo em docs/evals/README.md. pnpm check verde. Não verificado: a qualidade do estudo (só um uso real mostra).
