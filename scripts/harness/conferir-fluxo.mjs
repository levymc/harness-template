/**
 * O conferidor do fluxo: o PR que mexe na barra (scripts/harness/barra.mjs) só entra com a decisão
 * de quem não o escreveu, tomada sobre a PONTA do PR — o último commit, não um anterior:
 *   - uma revisão aprovada no commit da ponta, de quem não é o autor do PR; ou
 *   - um comentário com `**Autorização do merge:**`, a linha `**Commit:** <sha da ponta>` e o texto
 *     literal da autorização numa linha que começa com `>` — o caminho num repositório de um dono só,
 *     em que o GitHub não deixa o autor aprovar o próprio PR.
 *
 * Roda da `main` (.github/workflows/fluxo.yml, pull_request_target): o PR não troca quem o julga.
 * O agente nunca escreve a autorização (regra `no-merge-by-agent` do motor); ela é da pessoa.
 *
 * Uso: GITHUB_TOKEN=… node scripts/harness/conferir-fluxo.mjs <dono/repositório> <número> [--status]
 *   --status publica o resultado como status "conferidor do fluxo" no commit da ponta.
 */
import { isMain } from './lib.mjs'
import { mudancasNaBarra } from './barra.mjs'

export const CONTEXTO = 'conferidor do fluxo'
const QUEM_REVISA = new Set(['OWNER', 'MEMBER', 'COLLABORATOR'])

/** Cliente mínimo da API do GitHub: recebe o endereço e o token, não lê o ambiente sozinho. */
export function github({ token, api = 'https://api.github.com', fetcher = fetch } = {}) {
  const pedir = async (metodo, caminho, corpo) => {
    const r = await fetcher(`${api}${caminho}`, {
      method: metodo,
      headers: { accept: 'application/vnd.github+json', 'user-agent': 'harness-conferidor', ...(token ? { authorization: `Bearer ${token}` } : {}), ...(corpo ? { 'content-type': 'application/json' } : {}) },
      body: corpo ? JSON.stringify(corpo) : undefined,
    })
    if (!r.ok) throw new Error(`GitHub respondeu ${r.status} em ${metodo} ${caminho}: confira o token e o nome do repositório`)
    return r.status === 204 ? null : r.json()
  }
  const paginas = async caminho => {
    const todos = []
    for (let pagina = 1; ; pagina++) {
      const lote = await pedir('GET', `${caminho}${caminho.includes('?') ? '&' : '?'}per_page=100&page=${pagina}`)
      todos.push(...lote)
      if (lote.length < 100) return todos
    }
  }
  return { pedir, paginas }
}

/** A autorização do merge num comentário: o cabeçalho, o commit da ponta e a citação literal. */
export function autorizacaoNaPonta(corpo, sha) {
  const texto = String(corpo ?? '')
  if (!/\*\*Autoriza[çc][ãa]o do merge:\*\*/i.test(texto)) return false
  const commit = /^\*\*Commit:\*\*\s*`?([0-9a-f]{7,40})`?\s*$/im.exec(texto)?.[1]
  if (!commit || !sha.startsWith(commit.toLowerCase())) return false
  return /^>\s*\S/m.test(texto)
}

/**
 * @returns {{ ok: boolean, resumo: string, achados: object[] }}
 */
export function julgar({ pr, arquivos, revisoes, comentarios }) {
  const ponta = pr.head.sha
  const autor = pr.user.login.toLowerCase()
  const { achados, semPatch } = mudancasNaBarra(arquivos)
  if (!achados.length && !semPatch.length) return { ok: true, resumo: 'o PR não mexe na barra', achados }
  const lista = [...achados.map(a => `${a.item}: ${a.caminho} — ${a.motivo}`), ...semPatch.map(c => `${c}: sem diff para conferir`)]
  const aprovacao = revisoes.find(r => r.state === 'APPROVED' && r.commit_id === ponta && r.user?.login?.toLowerCase() !== autor && QUEM_REVISA.has(r.author_association))
  if (aprovacao) return { ok: true, resumo: `mexe na barra, com revisão aprovada na ponta por ${aprovacao.user.login}`, achados: lista }
  const autorizacao = comentarios.find(c => autorizacaoNaPonta(c.body, ponta) && QUEM_REVISA.has(c.author_association))
  if (autorizacao) return { ok: true, resumo: `mexe na barra, com a autorização do merge na ponta (comentário de ${autorizacao.user.login})`, achados: lista }
  return {
    ok: false,
    resumo: `mexe na barra sem a decisão de quem não o escreveu sobre a ponta (${ponta.slice(0, 7)}): falta revisão aprovada nesse commit ou o comentário de autorização do merge citando-o`,
    achados: lista,
  }
}

/** Lê o PR inteiro pela API e julga. */
export async function conferirFluxo({ repo, numero, cliente }) {
  const pr = await cliente.pedir('GET', `/repos/${repo}/pulls/${numero}`)
  const arquivos = (await cliente.paginas(`/repos/${repo}/pulls/${numero}/files`)).map(f => ({
    caminho: f.filename, anterior: f.previous_filename, status: f.status, patch: f.patch, alteracoes: f.changes,
  }))
  const revisoes = await cliente.paginas(`/repos/${repo}/pulls/${numero}/reviews`)
  const comentarios = await cliente.paginas(`/repos/${repo}/issues/${numero}/comments`)
  return { pr, ...julgar({ pr, arquivos, revisoes, comentarios }) }
}

if (isMain(import.meta)) {
  const [repo, numero] = process.argv.slice(2).filter(a => !a.startsWith('--'))
  if (!repo || !/^\d+$/.test(numero ?? '')) {
    console.error('uso: GITHUB_TOKEN=… node scripts/harness/conferir-fluxo.mjs <dono/repositório> <número> [--status]')
    process.exit(2)
  }
  try {
    // A entrada lê o ambiente e passa o token ao cliente; o cliente não o lê sozinho.
    const cliente = github({ token: process.env.GITHUB_TOKEN })
    const { pr, ok, resumo, achados } = await conferirFluxo({ repo, numero, cliente })
    console.log(`${ok ? '✓' : '✗'} PR #${numero}: ${resumo}`)
    for (const a of achados) console.log(`  - ${a}`)
    if (process.argv.includes('--status')) {
      await cliente.pedir('POST', `/repos/${repo}/statuses/${pr.head.sha}`, { state: ok ? 'success' : 'failure', context: CONTEXTO, description: resumo.slice(0, 139) })
    }
    process.exit(ok ? 0 : 1)
  } catch (error) {
    console.error(error.message)
    process.exit(2)
  }
}
