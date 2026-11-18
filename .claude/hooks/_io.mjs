/**
 * Entrada e saída comuns dos hooks do Claude Code.
 *
 * Protocolo (code.claude.com/docs/en/hooks): o evento chega como JSON no stdin; exit 2
 * bloqueia e o stderr volta para o modelo como motivo; exit 0 segue (no SessionStart, o
 * stdout vira contexto; no PreToolUse, um JSON com `additionalContext` chega ao modelo).
 *
 * Dois modos de erro interno, escolhidos por hook (ADR 0006):
 *   - FAIL-OPEN (padrão): hook informativo (session-start, usage-log, stop-check) que quebra
 *     avisa no stderr e sai 0. Ele não protege nada; travar a sessão por ele é só custo.
 *   - FAIL-CLOSED: os guardas (bash-guard, file-guard). Guarda que deixa passar quando quebra
 *     não protege nada justamente quando mais importa, e quebra em silêncio. O guarda que
 *     quebra barra — e o `onError` dele abre só a porta para consertar o próprio guarda.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Este arquivo não importa nada do harness: é o que os guardas carregam ANTES do motor, para
 * que um erro de import ou de sintaxe numa regra caia no try do runHook e barre (fail-closed),
 * em vez de derrubar o processo com exit 1 — que o Claude Code trata como "deixa passar".
 * Visto pela revisão fria: com o import no topo do guarda, a regra quebrada deixava tudo passar.
 */
export function isMain(meta) {
  if (!process.argv[1]) return false
  const norm = path => resolve(path).replaceAll('\\', '/').toLowerCase()
  return norm(fileURLToPath(meta.url)) === norm(process.argv[1])
}

export function readInput() {
  try {
    const raw = readFileSync(0, 'utf8')
    return raw.trim() ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

/**
 * @param fn devolve null (passa), uma string (bloqueia) ou `{ block?: string, warn?: string }`
 * @param opts.failClosed erro interno bloqueia em vez de deixar passar
 * @param opts.onError (input, error) => null para deixar passar mesmo com o erro (a porta de conserto)
 */
export async function runHook(fn, { failClosed = false, onError } = {}) {
  const input = readInput()
  const nome = process.argv[1]?.split(/[\\/]/).pop()
  let veredito
  try {
    veredito = await fn(input)
  } catch (error) {
    if (!failClosed) {
      process.stderr.write(`[hook ${nome}] erro interno, deixando passar: ${error?.message}\n`)
      process.exit(0)
    }
    const porta = onError?.(input, error)
    if (porta === null) {
      process.stderr.write(`[hook ${nome}] erro interno; deixando passar só porque a ação conserta o próprio guarda: ${error?.message}\n`)
      process.exit(0)
    }
    process.stderr.write(`[hook ${nome}] erro interno, barrando por segurança: ${error?.message}\n` +
      'O guarda quebrado não pode deixar passar. Conserte o guarda (.claude/hooks/, scripts/harness/ ou harness.config.json — a escrita ali continua liberada) ou peça ao usuário. Ver docs/regras.md#quando-o-hook-quebra\n')
    process.exit(2)
  }
  // Bloqueio fora do try: um bloqueio legítimo nunca pode virar "erro interno".
  const { block, warn } = typeof veredito === 'string' ? { block: veredito } : (veredito ?? {})
  if (block) {
    process.stderr.write(`${block}\n`)
    process.exit(2)
  }
  if (warn) {
    process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: input.hook_event_name ?? 'PreToolUse', additionalContext: warn } }))
  }
}
