# PROGRESS — loop-do-harness

### 2026-11-18 — tarefa aberta, plano aprovado
- decisão: portar e neutralizar (forbiddenTerms continua valendo); atritos em issues do GitHub com label `atrito`; barra + conferidor rodado da main, sem auditoria selada; extras: mutação, motor com prova, auditoria da sessão, maturidade.
- achado: o harness de referência não tem memória de agente (o "teto de memória" dele é limite de RAM nos testes); a continuidade dele mora no card e no PR.
- achado: lacunas do template hoje — sem revisão fria, sem mutação, sem triagem de atrito, `passa:true` sem conferência de evidência, `bash -c "…"` passa pelo bash-guard, página HTML com números velhos.
- próximo passo: fatia 1 (motor de regras com prova).

### 2026-11-18 — fatia 1: motor de regras com prova
- feito: `scripts/harness/rules/` (engine, shell, catalog, 9 regras com proof); bash-guard e file-guard viram entrega fina; `rule-proofs` no check-claims; `docs/regras.md`; ADR 0006; guardrails cita `rule:<id>`; matcher Bash|PowerShell.
- decisão: fail-closed nos dois guardas, com porta de conserto (escrita em .claude/hooks/, scripts/harness/, harness.config.json liberada com o motor quebrado). Informativos seguem fail-open.
- decisão: `--force-with-lease` continua passando (comportamento do template, com teste), diferente da referência.
- evidência (critério 1): `pnpm check` exit 0 — harness:test 137/137, `✓ 19 regras conferidas`. prove.mjs vermelho em: tirar o desembrulho do `bash -c` (rule-proofs), trocar exit 2→0 no erro do guarda (hooks.test), tirar a distinção rm×rd do alvo `/x` (rule-proofs, depois de acrescentar o caso que faltava — a primeira prova ficou verde e mostrou o buraco).
- próximo passo: fatia 2 (validar-antes-de-concluir, falhas, revisão fria).

### 2026-11-18 — fatia 2: validar antes de concluir
- feito: skills `validar-antes-de-concluir` (+ lente funcionalidade-nativa), `cobrir-lacunas-de-teste`, `testes-agenticos`; agente `revisor-frio`; scripts `falhas.mjs`, `revisao-fria.mjs`, `recorte.mjs`, `suite.mjs`, `teto-de-memoria.mjs`; `fechar-tarefa`, `iniciar-tarefa` e `pre-push` ligadas à validação; 7 descriptions de skill reescritas (≤280, "Use quando").
- decisão: a `sabotar.mjs` da referência NÃO entrou como ferramenta nova — os cuidados dela (verificação verde antes, trecho único, recuperação de corrida cortada, CRLF, lista, tempo limite) foram para o `prove.mjs`, que já fazia o mesmo. Achado: o `prove.mjs` antigo "provava" qualquer coisa com a suíte já vermelha.
- decisão: o temp-limpo da referência rodava a suíte duas vezes; aqui o próprio `harness:test` roda por `suite.mjs` com Temp vazia e conta a sobra — mesmo efeito, sem custo de tempo.
- decisão: pedido da revisão fria e tentativas ficam em `.harness/` (gitignored); o diff ao revisor exclui `work/` e `.harness/` (o PROGRESS é raciocínio de quem escreveu).
- achado: a regra `script-flag` pegou os dois scripts novos (flag montado por concatenação não aparece literal) — consertado nos scripts, não na regra.
- evidência (critério 2): `pnpm check` exit 0 — harness:test 164/164 pela suite.mjs, sem sobra na Temp; `✓ 19 regras conferidas`. `prove.mjs --lista` com 7 sabotagens (verificação verde antes, evidência do work-tasks, "Use quando", teto 280, sobras da suíte, exclusão de work/ do diff, limite do falhas) → as 7 PEGAS.
- próximo passo: fatia 3 (mutação no CI).

### 2026-11-18 — fatia 3: mutação no CI
- feito: `@stryker-mutator/core` e `vitest-runner` 10.1.1 (devDependencies, versão fixa); `stryker.config.json` (harness, command runner) e `stryker.produto.config.json` (src/, Vitest, perTest); `scripts/harness/mutacao.mjs` (planejar/rodar, fatias por alvo, break por arquivo, recusa Stryker desligado sem motivo e corrida cortada); `.github/workflows/mutacao.yml` (check "Mutação do PR"); script `pnpm mutation`.
- decisão: o grafo de testes segue import TRANSITIVO (a referência só segue o direto): as regras do motor são testadas pelo catálogo que as importa e ficariam "sem teste".
- decisão: a mutação é do template, não viaja na adoção (depende do Stryker/pnpm) — `layerExclude`.
- achado: pnpm esconde o vitest-runner do core; `plugins` explícito no config resolve.
- achado: rodada real em `falhas.mjs` deu 58,5% (61 vivos) com os testes da fatia 2 — testes novos com saída exata levaram a fatia acima do break (exit 0). Mostra que esta própria entrega tem lacunas que a mutação do CI vai cobrar nas outras 32 fatias deste PR.
- achado (fora do escopo): `src/items/items.service.ts` tem 33% — o esqueleto cobre o serviço só pelo e2e, que a mutação não roda.
- evidência (critério 3): `pnpm check` exit 0 (harness:test 177/177); `mutacao.mjs planejar --base origin/main` gerou 33 fatias; `rodar --alvo harness` em falhas.mjs: 58,50% → exit 1, depois dos testes → exit 0; `rodar --alvo produto` em items.service.ts rodou com o Vitest (33,33%, exit 1 pelo break). O workflow só roda no GitHub: NÃO verificado.
- próximo passo: fatia 4 (loop de atrito e auditoria da sessão).
