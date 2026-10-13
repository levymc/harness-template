/**
 * Stop: antes de o agente dizer "pronto", o repositório tem de continuar dizendo a verdade.
 *
 * Roda o check-claims (que inclui o lint da memória) e, se houver .ts alterado, o
 * typecheck. Silencioso no sucesso; no fracasso, exit 2 com SÓ os erros — o agente
 * continua trabalhando até consertar. Saída verbosa de sucesso inundaria o contexto.
 *
 * `stop_hook_active` evita laço: se o agente já está continuando por causa deste hook e
 * ainda assim não conseguiu, deixamos parar — e o vermelho aparece no próximo Stop, no
 * pre-push e no CI. Prender o agente num laço infinito é pior que um vermelho visível.
 *
 * Por que o typecheck aqui: runner de teste que transpila sem checar tipos (Vitest, por
 * exemplo) passa verde com código que o build recusa — já aconteceu no esqueleto deste
 * template. Só roda se houver tsconfig.json e typescript instalado.
 */
import { spawnSync, execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { ROOT } from '../../scripts/harness/lib.mjs'
import { runChecks } from '../../scripts/harness/check-claims.mjs'
import { isMain, runHook } from './_io.mjs'

function tsAlterado() {
  try {
    return execFileSync('git', ['status', '--porcelain'], { cwd: ROOT, encoding: 'utf8' })
      .split('\n').some(l => /\.ts$/.test(l.trim()) || /tsconfig.*\.json$/.test(l.trim()))
  } catch {
    return false
  }
}

function typecheck() {
  const tsc = resolve(ROOT, 'node_modules/typescript/bin/tsc')
  if (!existsSync(tsc) || !existsSync(resolve(ROOT, 'tsconfig.json'))) return []
  const r = spawnSync(process.execPath, [tsc, '--noEmit', '-p', 'tsconfig.json'], { cwd: ROOT, encoding: 'utf8' })
  if (r.status === 0) return []
  return (r.stdout + r.stderr).split('\n').filter(l => /error TS\d+/.test(l)).slice(0, 15)
}

if (isMain(import.meta)) {
  await runHook(input => {
    if (input.stop_hook_active) return null
    const erros = runChecks(ROOT).map(e => `[${e.rule}] ${e.erro}`)
    if (tsAlterado()) erros.push(...typecheck().map(l => `[typecheck] ${l.trim()}`))
    if (!erros.length) return null
    return ['O repositório não está consistente — conserte antes de encerrar:', ...erros.slice(0, 25).map(e => `  - ${e}`)].join('\n')
  })
}
