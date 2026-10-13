# O harness, e por que cada peça existe

O `AGENTS.md` entra em contexto em toda sessão e tem teto de linhas; este documento é o
contexto longo que ele não pode carregar. Leia ao mexer no harness, não para trabalhar
no produto.

## A tese

Num projeto trabalhado por agentes, quase todo defeito sério é uma **afirmação não
verificada**, e não um erro de lógica: um teste que passava pelo motivo errado, um
comando documentado que não existia, uma regra escrita que ninguém impunha, uma memória
que descrevia um código que já tinha mudado. Daí três princípios:

1. **Prefira uma checagem a uma frase.** Prosa não falha, então decai; código falha,
   então permanece.
2. **Uma checagem nunca vista falhar é decoração.** Toda regra e todo hook daqui foi
   visto vermelho com a regressão introduzida de propósito.
3. **Diga o que não foi verificado** com o mesmo destaque do que passou.

## As peças

| Peça | Papel |
|---|---|
| `AGENTS.md` / `CLAUDE.md` | entrada curta e escrita à mão; `CLAUDE.md` só importa o `AGENTS.md` |
| `harness.config.json` | tetos, termos proibidos (por hash), branches protegidas, e o manifesto da camada para adoção |
| `.claude/hooks/` | o que tem de acontecer sempre, sem depender do agente lembrar |
| `.claude/skills/` | procedimentos, carregados só quando o assunto aparece |
| `.claude/agents/` | três subagentes de escopo estreito, `tools:` explícito |
| `scripts/harness/check-claims.mjs` | o repositório não afirma sobre si o que não é verdade |
| `scripts/harness/memory.mjs` | índice, lint, verificação e criação de fatos |
| `scripts/harness/adopt.mjs` | leva a camada de harness a um repositório existente |
| `scripts/harness/prove.mjs` | aplica uma regressão de propósito, roda a verificação e reverte: "prove que pega" executável |
| `scripts/harness/test/` | o harness testado como código, nos dois sentidos |
| `docs/guardrails.md` | toda proibição, com sensor, origem e condição de expiração |
| `docs/memory/` · `docs/decisions/` · `work/` | memória semântica, decisões, trabalho em andamento |

## Os hooks

- **SessionStart** imprime o estado: branch, commits, tarefas abertas, fatos suspeitos e
  o índice da memória. É o ritual de início de sessão dos agentes de longa duração —
  "onde estou, o que foi feito, o que está aberto" — feito por código, porque em prosa
  o agente pula.
- **PreToolUse(Bash)** — `bash-guard.mjs`: commit na branch protegida, `--force`,
  `--no-verify`, `reset --hard`, `clean -f`, `rm -rf` fora dos diretórios gerados,
  migração remota, menção a segredo, termo proibido. Ignora o que está entre aspas e em
  heredoc: `git commit -m "conserta o push to main"` numa branch de feature passa. O
  primeiro commit do repositório passa mesmo na main.
- **PreToolUse(Read|Edit|Write)** — `file-guard.mjs`: segredo não entra no contexto;
  termo proibido não entra no repositório (barrado na escrita, antes do check).
- **Stop** — `stop-check.mjs`: `check-claims` + typecheck quando há `.ts` alterado.
  Silencioso no sucesso; no fracasso devolve só os erros e o agente continua. Com
  `stop_hook_active` ele deixa parar, para não prender o agente num laço.
- **PostToolUse(Skill)** e **SubagentStop** — `usage-log.mjs`: grava o uso em
  `.harness/usage.jsonl`, local. Sem medida, aposentar skill é palpite.

Todos são **fail-open**: um erro interno do hook avisa e deixa passar. Guarda que trava
tudo quando quebra é desligada no primeiro dia.

## A memória

O desenho está em `docs/memory/README.md`. As três escolhas que mais importam:

- **Um lugar só.** A auto-memória do Claude Code fica desligada (`autoMemoryEnabled:
  false`, conferido pela regra `settings-hygiene`). Ela mora fora do repositório,
  numa pasta da máquina, e vira um segundo sistema que ninguém revisa.
- **Fato com citação, verificado na leitura.** Cada fato cita `path` + `anchor`. O lint
  reprova citação morta; o `verify` marca como suspeito o fato cujo arquivo citado mudou
  no git depois da verificação. Staleness medida por mudança de código, não por
  calendário — na memória do Copilot, esse tipo de verificação subiu o merge rate de
  PRs de 83% para 90%.
- **Episódica morre.** Tarefa em `work/` é destilada e apagada ao fechar. Pasta de task
  permanente e `decisions.md` append-only foram, nos projetos de origem, os dois maiores
  acúmulos de texto que ninguém relia.

Este documento é da camada de harness e viaja na adoção; por isso não fala do código do
produto. As guardas do esqueleto NestJS + Sequelize do template (e o que ele já
ensinou) ficam no documento do esqueleto, apontado pelo `AGENTS.md` do template.

## Estendendo

1. **Uma checagem antes de uma frase**, na ordem: teste → regra de check/hook → linha de
   skill → fato de memória (skill `licao`).
2. **Prove que pega** com `scripts/harness/prove.mjs`, e teste os dois sentidos: o que
   tem de pegar e o que não pode. Um detector que grita em texto legítimo é desligado, e
   aí não protege nada. Os testes deste harness passaram de primeira e a mutação achou
   dois que passavam pelo motivo errado: o de fail-open nunca chegava ao `catch`, e o de
   "texto entre aspas não conta" passava porque a aspa colava no flag (`--force"`) e o
   comando perigoso não casava nem sem a guarda.
3. **Guarda textual procura a chamada, não o nome**: o `import` sozinho satisfaz uma
   regra que procura o nome.
4. **Não afrouxe um guarda para deixar verde.** Vermelho novo depois de um guarda novo
   quase sempre é um verde que estava mentindo.
5. **A camada não fala do produto.** Tudo em `layer` viaja para outros repositórios; se
   citar um arquivo, script ou comando do template, o projeto adotado nasce vermelho.
   `scripts/harness/test/adopt.test.mjs` adota num projeto fictício e roda o check-claims
   copiado — o único vermelho aceito é o trabalho da adoção (marcadores pendentes e a
   memória antiga a migrar). Ele pegou quatro vazamentos assim; a adoção numa cópia de
   um projeto real pegou mais dois falsos positivos (`pnpm <bin>` de dependência e uma
   skill que presumia `pnpm test`).
6. **Uma lição, um lugar.** Ao acrescentar prosa, apague a que a checagem nova já
   garante.

## O que o harness não cobre

- Comportamento: os checks verificam existência, forma e coerência. O que o código faz
  é trabalho de teste.
- Se o harness ajuda: só evals respondem isso (`docs/evals/README.md`).
- Julgamento: ler o diff, olhar a tela, perguntar ao usuário quando a decisão é dele.

## Fontes

- [Anthropic — Effective harnesses for long-running agents](https://anthropic.com/engineering/effective-harnesses-for-long-running-agents)
- [GitHub — Building an agentic memory system for GitHub Copilot](https://github.blog/ai-and-ml/github-copilot/building-an-agentic-memory-system-for-github-copilot/)
- [Marmelab — The state of AI harness engineering 2026](https://marmelab.com/blog/2026/09/24/the-state-of-ai-harness-engineering-2026.html)
- [HumanLayer — Skill issue: harness engineering for coding agents](https://www.humanlayer.dev/blog/skill-issue-harness-engineering-for-coding-agents)
- [Claude Code — hooks](https://code.claude.com/docs/en/hooks) · [memória](https://code.claude.com/docs/en/memory)
