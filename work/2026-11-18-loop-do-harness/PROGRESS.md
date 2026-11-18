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

### 2026-11-18 — fatia 4: loop de atrito e auditoria da sessão
- feito: `scripts/harness/sessao.mjs` (lê o .jsonl do Claude Code, numera turnos, mascara segredo, trecho), `atrito.mjs` (gerar/fila/triagem — fila = issues com label `atrito` pelo gh; nunca publica sozinho), `conferir-sessao.mjs` (4 faltas ao ritual); skills `relatar-atrito` e `triar-atrito`; `fechar-tarefa` roda a auditoria; `jardinagem` lê a fila e procura aviso repetido.
- decisão: relato e triagem num script só (`atrito.mjs`), sem Jira; publicar issue/comentário é sempre do agente com OK do usuário.
- decisão: mascaramento mais simples que o da referência (formas comuns); limite declarado no script e na skill.
- achado: rodar a auditoria contra ESTA sessão deu falso positivo — a regex de push acusou os commits cuja mensagem cita `git push --force`. Trocada pelo parser de shell do motor; o caso virou teste. (Mesma lição do bash-guard antigo: texto entre aspas é dado.)
- achado: no Windows, o caminho devolvido em minúsculas quebrava a detecção do PROGRESS.md; corrigido com teste.
- evidência (critério 4): `pnpm check` exit 0 — harness:test 195/195; auditoria da sessão real: 1 falta, a esperada (resumo final ainda não escrito); `prove.mjs --lista` com 6 sabotagens (citação literal, vermelho da triagem, segredo no relato, push pelo parser, limite de edições, mascaramento de MAIÚSCULAS=) → as 6 PEGAS.
- não verificado: `gh issue create/list` contra o GitHub de verdade (só pelo dublê no teste).
- próximo passo: fatia 5 (a barra).

### 2026-11-18 — fatia 5: a barra
- feito: `scripts/harness/barra.mjs` (guardas por caminho para 8 itens: gate, regras/hooks, piso de mutação, sabotagem, revisão fria, triagem/auditoria, conferidor, autorização; sinais mudança/linha/trocada/termo/entra/donos), `conferir-fluxo.mjs` (revisão aprovada na ponta por quem não é o autor, ou autorização do merge citando o commit da ponta), `.github/workflows/fluxo.yml` (pull_request_target + issue_comment + dispatch, checkout só da main, publica o status "conferidor do fluxo"), regra `no-merge-by-agent` no motor, ADR 0007, invariante no AGENTS.md (77 linhas, teto 80), seção "O loop de melhoria e a barra" no docs/harness.md, pre-push roda a barra.
- decisão: sem auditoria selada (fora do escopo); num repo de um dono só, a autorização por comentário é o caminho, e a regra do motor impede o agente de escrevê-la pelo comando.
- achado: a primeira versão contava linha de JSDoc (` * texto`) como código — mudar doc de hook acionaria a barra. Corrigido com teste (a abertura `/*` continua contando).
- achado: a sabotagem achou 2 lacunas reais nos testes da barra (linha que só muda de lugar; termo que vai da skill para docs/ não compensa) — testes acrescentados, as 3 sabotagens agora PEGAS. Uma sabotagem minha era inócua (`/NUNCA|…/` não desliga a regex) — refeita.
- evidência (critério 5): `pnpm check` exit 0 — harness:test 212/212 (antes dos 2 casos novos), `✓ 19 regras conferidas`; `barra.mjs --base origin/main` nesta branch acusa os 8 itens (este PR precisa da autorização do dono); conferidor testado contra servidor HTTP local no papel da API; `prove.mjs --lista` 8 sabotagens: 5 pegas de primeira, 3 pegas depois dos testes novos.
- não verificado: o workflow `fluxo` e o status no GitHub de verdade; a proteção da main exigindo o status é configuração manual.
- próximo passo: fatia 6 (maturidade, custo, documentação, HTML).

### 2026-11-18 — fatia 6: maturidade, custo, documentação; gate inteiro
- feito: skill `achar-o-proximo-degrau` (+ perguntas por degrau, neutralizadas), `docs/gastar-menos-uso.md` (sem os números internos), README sem contagens soltas, `docs/harness-template.html` com contagens marcadas `data-harness` e tabela de regras completa, regra `html-stats` no check, linha no guardrails.
- memória: MANTIDA. Os 3 fatos suspeitos (citavam package.json e harness.config.json, mudados aqui) foram relidos — continuam verdadeiros — e reconfirmados com `memory touch`. `memory verify`: nenhum suspeito; `memory lint`: 3 fatos conferidos.
- evidência (critério 6): `check-claims --only html-stats` verde; prove.mjs com 3 sabotagens (contagem velha, regra trocada na tabela, comparação desligada) → as 3 PEGAS; README e harness.md atualizados; adopt.test verde (layer leva docs/regras.md; mutação fica no layerExclude).
- evidência (critério 7): gate inteiro na mesma rodada — `pnpm check` exit 0 (lint, typecheck, test 4/4, harness:check 20 regras, harness:test 216/216), `pnpm build` exit 0, `pnpm db:migrate` + `pnpm test:e2e` 4/4 (com .env do .env.example); `memory verify` sem suspeito; toda guarda nova provada com prove.mjs nas fatias 1–6.
- próximo passo: revisão fria (revisor-frio) e fechamento.

### 2026-11-18 — revisão fria, rodada 1: 10 achados, todos tratados
- 1 (bloqueia) wrappers `timeout`/`stdbuf`/`find -exec`: parser desembrulha; casos nas provas.
- 2 (bloqueia) `eval`, `| bash`, `iex`: parser desembrulha o eval; regra nova `no-hidden-command` barra shell lendo da entrada e Invoke-Expression.
- 3 (bloqueia) fail-closed não cobria erro de import: guardas importam só o `_io.mjs` (agora autossuficiente) e carregam o motor por import() dentro do runHook; teste com erro de sintaxe numa regra copiada. Achado durante o conserto: um heredoc deixou o próprio `_io.mjs` com erro de sintaxe por alguns comandos — todos os hooks saíram com 1 (passa) nesse intervalo, só comandos de leitura rodaram. Prova viva do achado.
- 4 (bloqueia) aprovação/merge pela API: `no-merge-by-agent` pega `…/reviews -f event=APPROVE` e as mutações GraphQL.
- 5 (bloqueia) barra sem sensor no repo adotado: `.github/workflows/fluxo.yml` entra no layer.
- 6 `+refspec` com lease agora barra; 7 `git push origin HEAD` na main barra; 8 reconferir depois de aprovar documentado; 9 ADR 0006 corrigida; 10 `git commit -uno` passa.
- evidência: `pnpm check` exit 0, harness:test 217/217, `rule-proofs` com os casos novos; o check pegou duas afirmações minhas no conserto (caminho de exemplo, contagem da página 10→11).

### 2026-11-18 — revisão fria, rodada 2: 12 achados; 11 corrigidos, 1 registrado como limite
- corrigidos: `HEAD:refs/heads/main`; `xargs` com git/rm/gh e `| bash /dev/stdin`, `pwsh -Command -`, `bash -c "$(cat)"` (no-hidden-command); `git -c core.hooksPath=…`; `--method=PUT`/`-XPUT`; `cat .env*` e `git show HEAD:.env`; `rm`/`ri -Recurse` no PowerShell; leitura liberada com o motor quebrado; fixture dos testes na barra; ponto `ci` sem uso removido; carregamento do motor num lugar só (`carregarMotor` no _io).
- limite registrado (ADR 0007): a autorização por comentário aceita o autor do PR — é o desenho do repositório de um dono só.
- decisão: sem terceira rodada — nenhum achado da rodada 2 bloqueia (nenhuma regressão contra o guarda antigo; o guarda é melhor esforço, registrado na ADR 0007; a barra no CI é o que segura).
- evidência: `pnpm check` exit 0, harness:test 218/218; prove.mjs nas 3 correções fora das provas de regra → as 3 PEGAS.
