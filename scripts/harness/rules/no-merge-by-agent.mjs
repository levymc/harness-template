/**
 * O agente nunca faz merge, nunca aprova PR e nunca escreve a autorização do merge. A barra
 * (scripts/harness/barra.mjs) só vale se a decisão sobre a ponta for de uma pessoa; num
 * repositório de um dono só, o agente roda com o token desse dono — sem esta regra, ele poderia
 * "autorizar" o próprio PR pelo `gh`.
 *
 * Limite: a autorização escrita num arquivo e enviada por `--body-file` não aparece no comando;
 * fica para a revisão e para o conferidor, que exige a citação literal da pessoa.
 */
import { parseShell } from './shell.mjs'

const AUTORIZACAO = /autoriza[çc][ãa]o do merge/i

function motivo(command) {
  if (command.program !== 'gh') return null
  const [grupo, acao, ...resto] = command.args.map(w => w.value)
  if (grupo === 'pr' && acao === 'merge') return 'merge de PR é decisão de uma pessoa, não do agente.'
  if (grupo === 'pr' && acao === 'review' && resto.some(a => a === '--approve' || a === '-a')) return 'aprovar PR é decisão de quem não o escreveu, não do agente.'
  if (grupo === 'api') {
    const tudo = [acao, ...resto].join(' ')
    // Revisão fria: aprovar por REST (`…/reviews -f event=APPROVE`) e merge/aprovação por GraphQL passavam.
    if (/\/merge\b/.test(tudo) && command.args.some(w => /^(?:-X|--method)(?:=?\w+)?$/.test(w.value))) return 'merge de PR pela API é decisão de uma pessoa, não do agente.'
    if (/\/reviews\b/.test(tudo) && /event=APPROVE/i.test(tudo)) return 'aprovar PR pela API é decisão de quem não o escreveu, não do agente.'
    if (/mergePullRequest|enablePullRequestAutoMerge|addPullRequestReview|submitPullRequestReview/.test(tudo)) return 'merge ou aprovação pela API GraphQL é decisão de uma pessoa, não do agente.'
  }
  return null
}

export default {
  id: 'no-merge-by-agent',
  reason: 'O merge e a decisão sobre a barra são de uma pessoa; o agente que se autoriza anula a barra.',
  points: ['agent-hook'],
  defaultMode: 'block',
  // Stryker disable all: a prova é o teste da regra — mutar um caso dela é mutar o teste (um "allows" trocado por vazio passa por construção)
  proof: {
    catches: [
      { command: 'gh pr merge 12 --squash' },
      { command: 'gh pr review 12 --approve' },
      { command: 'gh pr comment 12 --body "**Autorização do merge:** ok"' },
      { command: 'gh api -X PUT repos/o/r/pulls/12/merge' },
      { command: 'bash -c "gh pr merge 12"' },
      { command: 'gh api repos/o/r/pulls/12/reviews -f event=APPROVE' },
      { command: "gh api graphql -f query='mutation { mergePullRequest(input: {pullRequestId: \"x\"}) { clientMutationId } }'" },
      { command: 'timeout 30 gh pr merge 12' },
      { command: 'gh api --method=PUT repos/o/r/pulls/12/merge' },
      { command: 'gh api -XPUT repos/o/r/pulls/12/merge' },
    ],
    allows: [
      { command: 'gh pr create --draft --title x --body-file .harness/pr.md' },
      { command: 'gh pr review 12 --comment --body "achados"' },
      { command: 'gh pr view 12' },
      { command: 'gh api repos/o/r/pulls/12/reviews' },
      { command: 'git merge origin/main' },
    ],
  },
  // Stryker restore all
  evaluate(action) {
    if (action.kind !== 'shell') return []
    const found = parseShell(action.command, action.shell).map(motivo).filter(Boolean)
    if (AUTORIZACAO.test(action.command) && /\bgh\b/.test(action.command)) found.push('a autorização do merge é escrita pela pessoa que decide, nunca pelo agente.')
    return found
  },
}
