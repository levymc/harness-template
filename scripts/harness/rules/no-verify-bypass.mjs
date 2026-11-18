/**
 * `--no-verify` pula os hooks do git — o conserto do que o hook reclamou vira "não olhar".
 * No `commit`, o `-n` é o mesmo flag (também colado: `-nm`); no `push`, `-n` é `--dry-run`.
 */
import { gitInvocation, parseShell } from './shell.mjs'

/** No grupo de flags curtas, para nas que levam valor colado: `-uno` é -u no, não -n (revisão fria). */
function temN(arg) {
  if (!/^-[a-zA-Z]+$/.test(arg)) return false
  for (const c of arg.slice(1)) {
    if (c === 'n') return true
    if ('umcCFtS'.includes(c)) return false
  }
  return false
}

export default {
  id: 'no-verify-bypass',
  reason: 'Pular os hooks do git esconde o problema que eles apontaram em vez de consertá-lo.',
  points: ['agent-hook'],
  defaultMode: 'block',
  // Stryker disable all: a prova é o teste da regra — mutar um caso dela é mutar o teste (um "allows" trocado por vazio passa por construção)
  proof: {
    catches: [
      { command: 'git commit --no-verify -m x' },
      { command: 'git commit -n -m x' },
      { command: 'git commit -anm x' },
      { command: 'git push --no-verify origin feat/x' },
      { command: 'sh -c "git commit --no-verify -m x"' },
      { command: 'git -c core.hooksPath=/dev/null commit -m x' },
    ],
    allows: [
      { command: 'git commit -m "documenta por que nunca usar --no-verify"' },
      { command: 'git commit -am x' },
      { command: 'git commit -uno -m x' },
      { command: 'git push -n origin feat/x' },
    ],
  },
  // Stryker restore all
  evaluate(action) {
    if (action.kind !== 'shell') return []
    const found = []
    for (const command of parseShell(action.command, action.shell)) {
      const git = gitInvocation(command)
      if (git?.sub !== 'commit' && git?.sub !== 'push') continue
      // `git -c core.hooksPath=/dev/null commit` desliga os hooks do mesmo jeito (revisão fria).
      const semHooks = git.configs.some(c => /^core\.hookspath=/i.test(c))
      const pula = semHooks || git.args.includes('--no-verify') || (git.sub === 'commit' && git.args.some(temN))
      if (pula) found.push('--no-verify pula os hooks do git. Conserte o que o hook reclamou.')
    }
    return found
  },
}
