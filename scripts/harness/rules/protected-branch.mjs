/**
 * Commit ou push direto em branch protegida (`protectedBranches` do harness.config.json).
 * O PRIMEIRO commit do repositório passa, mesmo na main: ainda não há de onde ramificar.
 */
import { gitInvocation, parseShell } from './shell.mjs'

export default {
  id: 'protected-branch',
  reason: 'Branch protegida só recebe mudança por PR, com revisão; commit ou push direto pula a revisão.',
  points: ['agent-hook'],
  defaultMode: 'block',
  proof: {
    catches: [
      { branch: 'main', command: 'git commit -m x' },
      { command: 'git push origin main' },
      { command: 'git push origin HEAD:main' },
      { branch: 'main', command: 'git push' },
      { command: 'bash -c "git push origin master"' },
      { branch: 'main', command: 'git push origin HEAD' },
      { command: 'git push origin HEAD:refs/heads/main' },
    ],
    allows: [
      { command: 'git commit -m "conserta o push to main"' },
      { branch: 'main', hasCommits: false, command: 'git commit -m inicial' },
      { command: 'git push -u origin feat/x' },
      { command: 'git push origin main-legado' },
      { command: 'git push origin HEAD' },
    ],
  },
  evaluate(action, config) {
    if (action.kind !== 'shell') return []
    const protegidas = config?.protectedBranches ?? ['main', 'master']
    const found = []
    for (const command of parseShell(action.command, action.shell)) {
      const git = gitInvocation(command)
      if (git?.sub === 'commit' && protegidas.includes(action.branch) && action.hasCommits) {
        found.push(`commit direto em ${action.branch}. Crie uma branch (git switch -c <tipo>/<assunto>) e commite lá.`)
      }
      if (git?.sub === 'push') {
        const refspecs = git.args.filter(a => !a.startsWith('-')).slice(1)
        // HEAD é a branch atual: `git push origin HEAD` na main é push na main (revisão fria).
        const destino = r => {
          const d = r.replace(/^\+/, '').split(':').pop().replace(/^refs\/heads\//, '')
          return d === 'HEAD' ? action.branch : d
        }
        const alvoProtegido = refspecs.some(r => protegidas.includes(destino(r)))
        if (alvoProtegido || (!refspecs.length && protegidas.includes(action.branch))) found.push('push direto para branch protegida. Abra um PR.')
      }
    }
    return found
  },
}
