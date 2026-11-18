# Regras de ação do agente

Cada seção é uma regra do motor em `scripts/harness/rules/`, com o id como título. A
mensagem de bloqueio do hook aponta para cá (`docs/regras.md#<id>`). O que a regra barra e
o que ela deixa passar está na `proof` dela, no arquivo da regra, e roda a cada
`pnpm harness:check` (regra `rule-proofs`). Contrato e motivo do desenho: ADR 0006.

O modo de cada regra (`block`, `warn` ou `off`) pode ser trocado em `harness.config.json`,
em `rules.<id>.mode`. Trocar é um diff visível — e mexe na barra (ver `docs/harness.md`).

## forbidden-term

Termo de `forbiddenTerms` no comando (mensagem de commit inclusive) ou na escrita dentro do
repositório. O termo é guardado como hash. **O que fazer:** reescreva sem o termo; se o termo
precisa mesmo aparecer, a decisão é do dono do repositório.

## no-secret-access

Ler, escrever ou citar no comando `.env*`, chave (`.pem`, `.key`, `id_rsa`) ou
`credentials*.json`. **O que fazer:** as variáveis estão no `.env.example`; um valor real,
peça ao usuário. `cp .env.example .env` passa.

## no-remote-migration

`migrate.mjs --remote`. **O que fazer:** migration em banco não-local é do pipeline de deploy
(ADR 0002 do template). Localmente, rode a migration sem `--remote`.

## no-recursive-delete

`rm -rf` (ou `Remove-Item -Recurse`, `rd /s`) fora de `safeRmTargets`, ou com alvo que só
existe na hora de rodar (`$X`, glob). **O que fazer:** apague arquivo por arquivo, ou peça ao
usuário.

## no-verify-bypass

`git commit --no-verify` (ou `-n`) e `git push --no-verify`. **O que fazer:** conserte o que o
hook do git reclamou.

## protected-branch

Commit ou push direto em branch de `protectedBranches`. O primeiro commit do repositório
passa. **O que fazer:** `git switch -c <tipo>/<assunto>`, commite lá e abra PR quando o
usuário pedir.

## no-force-push

`git push --force`, `-f`, `--mirror` ou refspec `+`. `--force-with-lease` passa. **O que
fazer:** se reescrever o remoto é mesmo preciso, `--force-with-lease` numa branch sua, com o
usuário pedindo.

## no-discard-work

`git reset --hard`, `git clean -f`, `git checkout .`, `git restore .`. **O que fazer:** para
deixar trabalho de lado, commit WIP ou `git stash push -u -m <tag>`.

## commit-message-format

Em `warn`: mensagem de commit fora de `tipo(escopo): assunto`. Merge, revert e `fixup!`
passam. **O que fazer:** reescreva o assunto; a lista de tipos pode ser trocada em
`rules.commit-message-format.types`.

## Quando o hook quebra

Os guardas (`bash-guard`, `file-guard`) **falham fechado**: se o motor quebra (config
ilegível, bug numa regra), o comando é barrado com "erro interno, barrando por segurança".
Guarda que deixa passar quando quebra não protege nada justamente quando mais importa.

Para não prender ninguém, a escrita em `.claude/hooks/`, `scripts/harness/` e
`harness.config.json` continua liberada com o motor quebrado — é por ali que se conserta.
Segredo continua barrado mesmo nessa porta. Se nem assim der, peça ao usuário. Os hooks
informativos (`session-start`, `usage-log`, `stop-check`) continuam deixando passar quando
quebram.

## Acrescentar uma regra

1. Um arquivo em `scripts/harness/rules/<id>.mjs` com `id`, `reason`, `points`,
   `defaultMode`, `proof` (`catches` e `allows`, os dois com casos) e `evaluate` puro.
2. Uma linha em `scripts/harness/rules/catalog.mjs` e uma seção aqui.
3. Nasce em `warn` quando o custo de um falso positivo é alto; vai para `block` com uso.
4. `pnpm harness:check --only rule-proofs` e, para provar que pega, o `prove.mjs` (ver skill
   `licao`).
