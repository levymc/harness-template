@AGENTS.md

## Só do Claude Code

- Os hooks em `.claude/settings.json` são parte das regras: um bloqueio deles traz o
  motivo e o que fazer. Não contorne (outro comando que faz a mesma coisa, `--no-verify`,
  editar o hook) — se o bloqueio estiver errado, diga ao usuário; o hook tem teste.
- `/init` não deve ser usado para regenerar este arquivo nem o `AGENTS.md`.
