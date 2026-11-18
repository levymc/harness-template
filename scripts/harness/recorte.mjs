/**
 * O recorte da entrega: os arquivos que a branch mudou desde a base e, para cada arquivo de
 * código, os testes que o citam. É o ponto de partida da skill `cobrir-lacunas-de-teste`, não
 * o veredito: arquivo com teste ainda pode ter regra sem teste, e a sabotagem (`prove.mjs`) é
 * que mostra.
 *
 * Uso: node scripts/harness/recorte.mjs [--base <ref>] [--json]
 * Sem --base, usa a branch padrão do remoto (origin/HEAD) e, sem ela, origin/main.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { basename, extname, join } from 'node:path'
import { isMain, ROOT } from './lib.mjs'

const CODIGO = new Set(['.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.java', '.kt', '.py', '.go', '.rb', '.cs', '.php', '.sql'])
const TESTE = /(^|\/)(__tests__|tests?|spec)\/|[._-](test|spec)\.[a-z]+$|(Test|Tests|IT)\.(java|kt)$|(^|\/)test_[^/]+\.py$|_test\.go$|\.e2e-spec\.[a-z]+$/

const git = (raiz, ...args) => execFileSync('git', ['-C', raiz, ...args], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).trim()

export function baseDoRepositorio(raiz) {
  try {
    return git(raiz, 'symbolic-ref', '--short', 'refs/remotes/origin/HEAD')
  } catch {
    return 'origin/main'
  }
}

export const ehTeste = caminho => TESTE.test(caminho)
const nome = caminho => basename(caminho, extname(caminho))
const escapar = t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const pasta = caminho => caminho.split('/').slice(0, -1)

/**
 * O teste "cita" o arquivo quando tem o mesmo nome com sufixo de teste, quando o importa ou,
 * em Java e Kotlin, quando usa a classe. Nome que se repete no repositório (index, utils) não
 * basta: aí vale só o teste da mesma pasta e o import com a pasta junto.
 */
export function cita(teste, textoDoTeste, arquivo, unico) {
  const n = nome(arquivo)
  const daPasta = pasta(arquivo).at(-1)
  const base = nome(teste).replace(/[._-](test|spec|e2e-spec)$|(Test|Tests|IT)$|^test_/g, '')
  if (base === n && (unico || pasta(teste).join('/') === pasta(arquivo).join('/'))) return true
  const alvo = unico || !daPasta ? escapar(n) : `${escapar(daPasta)}[/.]${escapar(n)}`
  if (new RegExp(`[/'"]${unico ? '' : '(?:[\\w.-]+/)*'}${alvo}(\\.[a-z]+)?['"]`).test(textoDoTeste)) return true
  if (/\.py$/.test(arquivo) && new RegExp(`\\b(from|import)\\s+([\\w.]*\\.)?${alvo}\\b`).test(textoDoTeste)) return true
  if (/\.(java|kt)$/.test(arquivo)) return new RegExp(`\\b${escapar(n)}\\b`).test(textoDoTeste)
  return false
}

export function recorte({ raiz = ROOT, base = baseDoRepositorio(raiz) } = {}) {
  const mudados = git(raiz, 'diff', '--name-only', '--diff-filter=ACMR', `${base}...HEAD`).split('\n').filter(Boolean)
  const rastreados = git(raiz, 'ls-files').split('\n').filter(Boolean)
  const testes = rastreados.filter(ehTeste)
  const textos = new Map(testes.map(t => [t, readFileSync(join(raiz, t), 'utf8')]))
  const nomesDeCodigo = rastreados.filter(f => !ehTeste(f) && CODIGO.has(extname(f))).map(nome)
  const codigo = mudados.filter(f => !ehTeste(f) && CODIGO.has(extname(f)))
  const arquivos = codigo.map(arquivo => {
    const unico = nomesDeCodigo.filter(n => n === nome(arquivo)).length <= 1
    const queCitam = testes.filter(t => cita(t, textos.get(t), arquivo, unico))
    return { arquivo, testes: queCitam, testeMudou: queCitam.some(t => mudados.includes(t)) }
  })
  return {
    base,
    arquivos,
    semTeste: arquivos.filter(a => !a.testes.length).map(a => a.arquivo),
    semTesteNovo: arquivos.filter(a => a.testes.length && !a.testeMudou).map(a => a.arquivo),
    testesMudados: mudados.filter(ehTeste),
    outros: mudados.filter(f => !ehTeste(f) && !CODIGO.has(extname(f))),
  }
}

export function relatorio(r) {
  const lista = (titulo, itens) => [`${titulo} (${itens.length})`, ...(itens.length ? itens.map(i => `- ${i}`) : ['- nenhum']), '']
  return [
    `Recorte contra ${r.base}`,
    '',
    ...lista('Código sem nenhum teste que o cite: lacuna provável, confirme procurando o teste', r.semTeste),
    ...lista('Código mudado com teste, mas nenhum teste mudou junto: confira se a regra nova tem teste', r.semTesteNovo),
    ...lista('Código mudado com teste mudado junto', r.arquivos.filter(a => a.testeMudou).map(a => `${a.arquivo} ← ${a.testes.filter(t => r.testesMudados.includes(t)).join(', ')}`)),
    ...lista('Outros arquivos (configuração, texto): leia se mudam comportamento', r.outros),
  ].join('\n')
}

if (isMain(import.meta)) {
  const args = process.argv.slice(2)
  const opcao = n => (args.includes(n) ? args[args.indexOf(n) + 1] : undefined)
  try {
    const r = recorte({ raiz: ROOT, base: opcao('--base') || baseDoRepositorio(ROOT) })
    console.log(args.includes('--json') ? JSON.stringify(r, null, 2) : relatorio(r))
  } catch (error) {
    console.error(error.message)
    process.exit(2)
  }
}
