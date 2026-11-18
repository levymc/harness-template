/**
 * Roda a suíte do harness (`pnpm harness:test`) com duas travas, sem custo de tempo a mais:
 *
 *   - **Temp limpa:** a suíte roda com TMPDIR/TEMP/TMP numa pasta vazia, e no fim o que sobrou
 *     nela reprova, com o nome. Cada fixture cria um repositório em os.tmpdir(); a que esquece
 *     de apagar enche a máquina — e a mutação e o prove.mjs rodam a suíte de novo a cada troca.
 *   - **Teto de RAM:** `--max-old-space-size` e o `teto-de-memoria.mjs` (o que cresce fora do
 *     heap): a troca que vira laço que só acumula morre em segundos, não trava a máquina.
 *
 * Uso: node scripts/harness/suite.mjs [arquivos de teste…]  (padrão: scripts/harness/test/*.test.mjs)
 */
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { isMain, ROOT } from './lib.mjs'

export const PADRAO = ['scripts/harness/test/*.test.mjs']
export const OPCOES_DO_NODE = ['--max-old-space-size=2048', '--import', './scripts/harness/teto-de-memoria.mjs']
/** O cache que o runtime guarda na Temp e reusa entre rodadas não é sobra de teste. */
const DO_RUNTIME = /^(?:node-compile-cache|hsperfdata_.+)$/

/** @returns {{ status: number, sobras: string[] }} */
export function rodarSuite(arquivos = PADRAO, { cwd = ROOT, stdio = 'inherit' } = {}) {
  const temp = mkdtempSync(join(tmpdir(), 'harness-suite-'))
  try {
    // Herdado de um `node --test` pai, o NODE_TEST_CONTEXT faz o filho só reportar ao pai.
    const { NODE_TEST_CONTEXT, ...env } = process.env
    const r = spawnSync(process.execPath, [...OPCOES_DO_NODE, '--test', ...arquivos], {
      cwd, stdio, env: { ...env, TMPDIR: temp, TEMP: temp, TMP: temp },
    })
    const sobras = readdirSync(temp).filter(nome => !DO_RUNTIME.test(nome)).sort()
    return { status: r.status ?? 1, sobras }
  } finally {
    rmSync(temp, { recursive: true, force: true, maxRetries: 10 })
  }
}

if (isMain(import.meta)) {
  const args = process.argv.slice(2)
  const { status, sobras } = rodarSuite(args.length ? args : PADRAO)
  if (sobras.length) {
    console.error(`\n✗ a suíte deixou ${sobras.length} item(ns) na pasta temporária: ${sobras.join(', ')}\n  Todo teste que cria pasta em os.tmpdir() a apaga no after().`)
    process.exit(1)
  }
  process.exit(status)
}
