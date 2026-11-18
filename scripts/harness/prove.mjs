/**
 * "Prove que pega", executável: aplica uma regressão de propósito (sabotagem), roda a
 * verificação e REVERTE sempre. É a mesma ferramenta para provar uma guarda nova (skill
 * `licao`) e para achar lacuna de teste numa entrega (skill `cobrir-lacunas-de-teste`).
 *
 * Por que existe: ao escrever os testes deste harness, todos passaram de primeira — e a
 * mutação mostrou dois que passavam pelo motivo errado. O teste de fail-open nunca
 * chegava ao `catch`; o de "texto entre aspas não conta" passava porque a aspa de
 * fechamento colava no flag (`--force"`) e o comando perigoso não casava nem sem a
 * guarda. Ler o teste não mostrava nada disso. Quebrar a guarda mostrou na hora.
 *
 * Decisões (cada uma com teste em scripts/harness/test/prove.test.mjs):
 *   - a verificação tem de estar VERDE antes: suíte que já falha "pegaria" qualquer troca;
 *   - o trecho tem de aparecer UMA vez: senão não se sabe o que foi trocado;
 *   - a troca em andamento fica gravada em .harness/prova-pendente.json: se o processo
 *     morre sem chegar ao finally (fim de sessão, kill), a próxima chamada devolve o arquivo;
 *   - no arquivo com CRLF, a quebra de linha do trecho e da troca vira a do arquivo;
 *   - troca que faz a verificação estourar o tempo conta como pega (como o Timeout do Stryker).
 *
 * Uso:
 *   node scripts/harness/prove.mjs <arquivo> --de '<trecho literal>' --para '<substituto>' [--cmd '<comando>'] [--limite <s>]
 *   node scripts/harness/prove.mjs --lista sabotagens.json [--cmd '<comando>'] [--limite <s>]
 *     sabotagens.json: [{ "arquivo": "…", "de": "…", "para": "…" }, …]
 * O comando padrão é a suíte do harness. Para um teste do produto: --cmd 'pnpm test'.
 * Sai 0 quando a verificação pega todas, 1 quando alguma sobrevive, 2 quando não deu para provar.
 */
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { isMain, ROOT } from './lib.mjs'

export const PADRAO = 'node scripts/harness/suite.mjs'
export const PENDENTE = '.harness/prova-pendente.json'
const hash = buffer => createHash('sha256').update(buffer).digest('hex')

/** Devolve o arquivo que uma corrida cortada deixou sabotado; o arquivo editado depois não é tocado. */
export function devolverPendente(cwd) {
  const registro = resolve(cwd, PENDENTE)
  if (!existsSync(registro)) return null
  const p = JSON.parse(readFileSync(registro, 'utf8'))
  const caminho = resolve(cwd, p.arquivo)
  const original = Buffer.from(p.original, 'base64')
  const atual = existsSync(caminho) ? hash(readFileSync(caminho)) : null
  if (atual === hash(original)) {
    rmSync(registro)
    return null
  }
  if (atual !== p.sabotado) throw new Error(`${p.arquivo} mudou depois de uma prova cortada (\`${p.de}\` → \`${p.para}\`); confira com git diff e apague ${PENDENTE}`)
  writeFileSync(caminho, original)
  rmSync(registro)
  return `a prova cortada em ${p.arquivo} (\`${p.de}\` → \`${p.para}\`) tinha ficado no arquivo; ele voltou ao original`
}

/** O trecho vem com \n da linha de comando; no arquivo com CRLF (checkout do Windows), vira \r\n. */
export function naQuebraDoArquivo(texto, s) {
  if (!texto.includes('\r\n')) return s
  const crlf = t => t.replace(/\r?\n/g, '\r\n')
  return { ...s, de: crlf(s.de), para: crlf(s.para) }
}

export function conferir(sabotagens, cwd) {
  const erros = []
  if (!sabotagens.length) erros.push('nenhuma sabotagem pedida')
  sabotagens.forEach((s, i) => {
    const onde = `sabotagem ${i + 1}`
    if (!s.arquivo || !s.de || s.para === undefined) return erros.push(`${onde} sem "arquivo", "de" ou "para"`)
    if (s.de === s.para) return erros.push(`${onde}: "para" igual a "de" não sabota nada`)
    const caminho = resolve(cwd, s.arquivo)
    if (!existsSync(caminho)) return erros.push(`${onde}: ${s.arquivo} não existe`)
    const texto = readFileSync(caminho, 'utf8')
    const vezes = texto.split(naQuebraDoArquivo(texto, s).de).length - 1
    if (vezes === 0) erros.push(`${onde}: o trecho não aparece em ${s.arquivo} — a mutação não seria aplicada`)
    else if (vezes > 1) erros.push(`${onde}: o trecho aparece ${vezes} vezes em ${s.arquivo}; use um que exista uma vez só`)
  })
  return erros
}

export function rodar(cmd, cwd, limite) {
  // Herdado de um `node --test` pai, o NODE_TEST_CONTEXT faz o `node --test` filho só reportar ao pai e sair com 0.
  const { NODE_TEST_CONTEXT, ...env } = process.env
  const r = spawnSync(cmd, { cwd, env, shell: true, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: limite * 1000 })
  const estourou = r.error?.code === 'ETIMEDOUT'
  // Ctrl+C mata a suíte por sinal (ou 130 pelo shell, 0xC000013A no Windows): não é a suíte pegando a troca.
  const interrompida = !estourou && (Boolean(r.signal) || r.status === 130 || r.status === 0xc000013a)
  return { status: r.status, saida: `${r.stdout ?? ''}${r.stderr ?? ''}`, estourou, interrompida }
}

/** @returns {{ arquivo, de, para, pegou: boolean, status, estourou, saida }[]} */
export function proveTodas({ sabotagens, cmd = PADRAO, cwd = ROOT, limite = 600, rodarVerificacao = rodar, avisar = console.error }) {
  const devolvido = devolverPendente(cwd)
  if (devolvido) avisar(devolvido)
  const erros = conferir(sabotagens, cwd)
  if (erros.length) throw new Error(`prova recusada:\n- ${erros.join('\n- ')}`)
  const antes = rodarVerificacao(cmd, cwd, limite)
  if (antes.estourou) throw new Error(`a verificação sem sabotagem passou de ${limite} s; aumente --limite`)
  if (antes.interrompida) throw new Error('a verificação sem sabotagem foi interrompida')
  if (antes.status !== 0) throw new Error(`a verificação já falha sem sabotagem (exit ${antes.status}); deixe-a verde antes — senão "pegou" não prova nada:\n${ultimas(antes.saida)}`)

  const resultados = []
  // Sem um ouvinte, o Ctrl+C mataria este processo no meio do spawnSync, antes do finally.
  const ignorar = () => {}
  process.on('SIGINT', ignorar)
  try {
    for (const s of sabotagens) {
      const caminho = resolve(cwd, s.arquivo)
      const original = readFileSync(caminho)
      const texto = original.toString('utf8')
      const { de, para } = naQuebraDoArquivo(texto, s)
      const sabotado = texto.replace(de, () => para)
      const registro = resolve(cwd, PENDENTE)
      mkdirSync(dirname(registro), { recursive: true })
      writeFileSync(registro, JSON.stringify({ arquivo: s.arquivo, de: s.de, para: s.para, sabotado: hash(sabotado), original: original.toString('base64') }))
      let r
      try {
        writeFileSync(caminho, sabotado)
        r = rodarVerificacao(cmd, cwd, limite)
      } finally {
        writeFileSync(caminho, original)
        rmSync(registro, { force: true })
      }
      if (hash(readFileSync(caminho)) !== hash(original)) throw new Error(`${s.arquivo} não voltou ao original; confira com git diff`)
      if (r.interrompida) throw new Error(`prova interrompida em ${s.arquivo}; o arquivo voltou ao original e nada foi contado`)
      resultados.push({ ...s, pegou: r.estourou || r.status !== 0, status: r.status, estourou: r.estourou, saida: ultimas(r.saida) })
    }
  } finally {
    process.removeListener('SIGINT', ignorar)
  }
  return resultados
}

/** A forma antiga, de uma troca só (usada pela skill `licao` e pelos testes). */
export function prove({ file, de, para = '', cmd = PADRAO, cwd = ROOT, limite, rodarVerificacao, avisar }) {
  const [r] = proveTodas({ sabotagens: [{ arquivo: file, de, para }], cmd, cwd, limite, rodarVerificacao, avisar })
  return r
}

const ultimas = (saida, n = 12) => saida.replace(/\s+$/, '').split(/\r?\n/).slice(-n).join('\n')

export function relatorio(resultados, cmd) {
  const linhas = [`Verificação: ${cmd}`, '']
  for (const r of resultados) {
    const estado = r.pegou ? (r.estourou ? 'PEGA (estourou o tempo)' : `PEGA (exit ${r.status})`) : 'SOBREVIVEU'
    linhas.push(`- ${estado}: ${r.arquivo}: \`${r.de}\` → \`${r.para}\``)
  }
  const vivas = resultados.filter(r => !r.pegou).length
  linhas.push('', vivas
    ? `✗ ${vivas} de ${resultados.length} sabotagem(ns) passaram com a verificação VERDE — a guarda não pega, ou falta teste. Arquivos revertidos.`
    : `✓ a verificação ficou VERMELHA com ${resultados.length === 1 ? 'a regressão' : `as ${resultados.length} regressões`} — a guarda pega. Arquivos revertidos.`)
  return linhas.join('\n')
}

if (isMain(import.meta)) {
  const args = process.argv.slice(2)
  const valor = nome => (args.includes(nome) ? args[args.indexOf(nome) + 1] : undefined)
  const lista = valor('--lista')
  if (!lista && (!args[0] || args[0].startsWith('--') || valor('--de') === undefined)) {
    console.error("uso: node scripts/harness/prove.mjs <arquivo> --de '<trecho>' --para '<substituto>' [--cmd '<comando>'] [--limite <s>]\n     node scripts/harness/prove.mjs --lista sabotagens.json [--cmd '<comando>']")
    process.exit(2)
  }
  try {
    const sabotagens = lista
      ? JSON.parse(readFileSync(lista, 'utf8'))
      : [{ arquivo: args[0], de: valor('--de'), para: valor('--para') ?? '' }]
    const cmd = valor('--cmd') ?? PADRAO
    const resultados = proveTodas({ sabotagens, cmd, limite: Number(valor('--limite') ?? 600) })
    const texto = relatorio(resultados, cmd)
    const todas = resultados.every(r => r.pegou)
    ;(todas ? console.log : console.error)(texto)
    process.exit(todas ? 0 : 1)
  } catch (error) {
    console.error(`✗ ${error.message}`)
    process.exit(2)
  }
}
