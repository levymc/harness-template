/**
 * Entrada e saída comuns dos hooks do Claude Code.
 *
 * Protocolo (code.claude.com/docs/en/hooks): o evento chega como JSON no stdin; exit 2
 * bloqueia e o stderr volta para o modelo como motivo; exit 0 segue (no SessionStart, o
 * stdout vira contexto).
 *
 * FAIL-OPEN: erro interno do hook nunca bloqueia o trabalho — avisa no stderr e sai 0.
 * Um guarda que trava tudo quando quebra é desligado no primeiro dia, e aí não protege
 * mais nada.
 */
import { readFileSync } from 'node:fs'

export { isMain } from '../../scripts/harness/lib.mjs'

export function readInput() {
  try {
    const raw = readFileSync(0, 'utf8')
    return raw.trim() ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

export async function runHook(fn) {
  let veredito
  try {
    veredito = await fn(readInput())
  } catch (error) {
    process.stderr.write(`[hook ${process.argv[1]?.split(/[\\/]/).pop()}] erro interno, deixando passar: ${error?.message}\n`)
    process.exit(0)
  }
  // Bloqueio fora do try: um bloqueio legítimo nunca pode virar "erro interno, deixando passar".
  if (veredito) {
    process.stderr.write(`${veredito}\n`)
    process.exit(2)
  }
}
