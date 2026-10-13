/**
 * "Prove que pega", executável: aplica uma regressão de propósito, roda a verificação,
 * e REVERTE sempre. Sai 0 se a verificação ficou vermelha (a guarda pega) e 1 se ficou
 * verde (a guarda é decoração).
 *
 * Por que existe: ao escrever os testes deste harness, todos passaram de primeira — e a
 * mutação mostrou dois que passavam pelo motivo errado. O teste de fail-open nunca
 * chegava ao `catch`; o de "texto entre aspas não conta" passava porque a aspa de
 * fechamento colava no flag (`--force"`) e o comando perigoso não casava nem sem a
 * guarda. Ler o teste não mostrava nada disso. Quebrar a guarda mostrou na hora.
 *
 * Uso:
 *   node scripts/harness/prove.mjs <arquivo> --de '<trecho literal>' --para '<substituto>' [--cmd '<comando>']
 * O comando padrão é a suíte do harness. Para um teste do produto: --cmd 'pnpm test'.
 */
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { isMain, ROOT } from './lib.mjs'

export function prove({ file, de, para = '', cmd = 'node --test "scripts/harness/test/*.test.mjs"', cwd = ROOT }) {
  const path = resolve(cwd, file)
  if (!existsSync(path)) throw new Error(`${file} não existe`)
  const original = readFileSync(path, 'utf8')
  if (!original.includes(de)) throw new Error(`o trecho não aparece em ${file} — a mutação não seria aplicada`)
  writeFileSync(path, original.replace(de, para))
  try {
    const r = spawnSync(cmd, { cwd, shell: true, encoding: 'utf8' })
    return { pegou: r.status !== 0, status: r.status, saida: `${r.stdout}${r.stderr}` }
  } finally {
    writeFileSync(path, original)
  }
}

if (isMain(import.meta)) {
  const args = process.argv.slice(2)
  const valor = nome => (args.includes(nome) ? args[args.indexOf(nome) + 1] : undefined)
  const file = args[0]
  if (!file || valor('--de') === undefined) {
    console.error("uso: node scripts/harness/prove.mjs <arquivo> --de '<trecho>' --para '<substituto>' [--cmd '<comando>']")
    process.exit(2)
  }
  try {
    const r = prove({ file, de: valor('--de'), para: valor('--para') ?? '', cmd: valor('--cmd') })
    if (r.pegou) console.log(`✓ a verificação ficou VERMELHA com a regressão (exit ${r.status}) — a guarda pega. Arquivo revertido.`)
    else console.error('✗ a verificação continuou VERDE com a regressão — a guarda não pega nada. Arquivo revertido.')
    process.exit(r.pegou ? 0 : 1)
  } catch (error) {
    console.error(`✗ ${error.message}`)
    process.exit(2)
  }
}
