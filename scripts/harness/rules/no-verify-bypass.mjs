/**
 * `--no-verify` pula os hooks do git — o conserto do que o hook reclamou vira "não olhar".
 * No `commit`, o `-n` é o mesmo flag (também colado: `-nm`); no `push`, `-n` é `--dry-run`.
 */
import { gitInvocation, parseShell } from './shell.mjs'

export default {
  id: 'no-verify-bypass',
  reason: 'Pular os hooks do git esconde o problema que eles apontaram em vez de consertá-lo.',
  points: ['agent-hook'],
  defaultMode: 'block',
  proof: {
    catches: [
      { command: 'git commit --no-verify -m x' },
      { command: 'git commit -n -m x' },
      { command: 'git commit -anm x' },
      { command: 'git push --no-verify origin feat/x' },
      { command: 'sh -c "git commit --no-verify -m x"' },
    ],
    allows: [
      { command: 'git commit -m "documenta por que nunca usar --no-verify"' },
      { command: 'git commit -am x' },
      { command: 'git push -n origin feat/x' },
    ],
  },
  evaluate(action) {
    if (action.kind !== 'shell') return []
    const found = []
    for (const command of parseShell(action.command, action.shell)) {
      const git = gitInvocation(command)
      if (git?.sub !== 'commit' && git?.sub !== 'push') continue
      const pula = git.args.includes('--no-verify') || (git.sub === 'commit' && git.args.some(a => /^-[a-zA-Z]*n[a-zA-Z]*$/.test(a)))
      if (pula) found.push('--no-verify pula os hooks do git. Conserte o que o hook reclamou.')
    }
    return found
  },
}
