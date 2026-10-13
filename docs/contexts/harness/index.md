# Harness

**Leia quando:** for mexer em hook, regra do check-claims, script de memória, skill,
subagente ou na adoção do harness em outro repositório.

A camada que define como agentes trabalham neste repositório: o ritual de sessão, as
guardas, a memória e as lições que viram checagem. O porquê de cada peça está em
`docs/harness.md`.

## Onde está

- `.claude/hooks/`: um script por evento do Claude Code, todos fail-open.
- `scripts/harness/check-claims.mjs`: as regras, cada uma com id; `--list` mostra todas.
- `scripts/harness/memory.mjs`: índice, lint, verificação e criação de fatos.
- `scripts/harness/prove.mjs`: aplica uma regressão de propósito e confirma o vermelho.
- `scripts/harness/adopt.mjs` e `scripts/harness/templates/`: a adoção em outro repo.
- `scripts/harness/test/`: a suíte do próprio harness, com fixture de repositório.
- `harness.config.json`: tetos, termos proibidos e o manifesto da camada.

## Regras desta área

- Toda regra e todo hook têm teste nos dois sentidos e foram vistos falhar.
- Nada da camada cita arquivo do produto: ela viaja para outros repositórios
  (`scripts/harness/test/adopt.test.mjs` guarda isso).
- Os scripts são Node puro, sem dependência, e rodam no Windows sem Git Bash.

## Memória

Fatos em `docs/memory/harness/`, listados no índice da memória.
