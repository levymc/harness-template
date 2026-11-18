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
