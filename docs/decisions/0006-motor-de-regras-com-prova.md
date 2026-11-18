---
status: accepted
date: 2026-11-18
supersedes:
superseded_by:
---

# 0006 — Motor de regras com prova, e guarda que falha fechado

## Contexto

As proibições do agente moravam dentro de `bash-guard.mjs` e `file-guard.mjs`, como `if`s.
Cada uma tinha teste em `hooks.test.mjs` — quando alguém lembrava de escrever. Duas falhas
apareceram ao comparar com um harness de referência que já tinha passado por isso:

- **Ponto cego.** O guarda tirava tudo o que estava entre aspas antes de olhar, para não
  gritar com `git commit -m "nunca use push --force"`. Com isso, `bash -c "git push --force"`
  passava: o comando perigoso estava "entre aspas".
- **Fail-open.** Erro interno do guarda deixava passar. A justificativa ("guarda que trava
  tudo é desligada no primeiro dia") é real, mas o efeito é o guarda quebrar em silêncio
  justamente quando um bug o deixa cego.

O harness de referência resolve as duas: um motor com contrato de encaixe (cada regra traz
a prova do que pega e do que deixa passar, rodada a cada check), um parser de shell que
desembrulha `bash -c`, `$(…)`, `pwsh -Command`, `cmd /c`, e hook que barra quando quebra.

## Decisão

As proibições do agente viram regras em `scripts/harness/rules/`, uma por arquivo, com
`id`, `reason`, `points`, `defaultMode` (`warn`/`block`, trocável em `rules.<id>.mode`),
`proof { catches, allows }` e `evaluate` puro. O check-claims ganha `rule-proofs`: contrato,
prova e seção em `docs/regras.md` de cada regra. Os hooks viram entregas finas sobre o motor.

Os dois guardas **falham fechado**, com uma porta de conserto: com o motor quebrado, a
escrita em `.claude/hooks/`, `scripts/harness/` e `harness.config.json` continua liberada
(segredo continua barrado). Os hooks informativos continuam fail-open.

## Alternativas consideradas

- **Manter os `if`s e só consertar o `bash -c`** — o próximo ponto cego apareceria do mesmo
  jeito, e nada obrigaria a escrever o caso vizinho que precisa passar.
- **Fail-closed sem porta** (como na referência) — um bug no motor impediria o próprio
  agente de consertá-lo; o usuário teria de editar à mão. A porta custa três prefixos.
- **Motor em camadas (domain/engines/services/delivery)** como na referência — o template
  tem nove regras de ação; as camadas esconderiam mais do que organizam. Uma pasta plana
  com o contrato no `engine.mjs` basta; revisitar se o catálogo crescer muito.

## Consequências

- Regra nova é um arquivo + uma linha no catálogo + uma seção em `docs/regras.md`; sem a
  prova nos dois sentidos, o Stop fica vermelho.
- A mensagem de bloqueio diz a regra e aponta a seção que explica o porquê e o que fazer.
- A ferramenta PowerShell passa pelo mesmo guarda (`matcher: Bash|PowerShell`).
- Um bug no motor agora barra comandos de shell até ser consertado. O `harness:test` e a
  `rule-proofs` no Stop existem para que isso apareça antes do commit.
- `docs/guardrails.md` cita a regra (`rule:<id>`) em vez do arquivo do hook.

## Revisar quando

- Um bug do motor travar uma sessão de um jeito que a porta de conserto não resolveu.
- O catálogo passar de ~20 regras, ou ganhar regras que olham o repositório e não a ação
  do agente (aí as camadas da referência começam a se pagar).
