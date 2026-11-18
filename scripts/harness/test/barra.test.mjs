/**
 * A barra: cada guarda vista acusar o afrouxamento que existe para pegar, e vista ficar quieta
 * no caso vizinho legítimo (a mudança fora da barra, o título de teste renomeado, a frase que só
 * mudou de arquivo). O conferidor, contra um servidor HTTP local no papel da API do GitHub.
 */
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { after, before, describe, it } from 'node:test'
import { arquivosDoGit, codigoDaLinha, donosMudados, mudancasNaBarra } from '../barra.mjs'
import { autorizacaoNaPonta, conferirFluxo, github, julgar } from '../conferir-fluxo.mjs'
import { cleanup, git, makeRepo, write } from './fixture.mjs'

const patch = (saem = [], entram = []) => ['@@ -1 +1 @@', ...saem.map(l => `-${l}`), ...entram.map(l => `+${l}`)].join('\n')
const mudou = (caminho, saem, entram, extra = {}) => ({ caminho, status: 'modified', patch: patch(saem, entram), ...extra })
const itens = arquivos => mudancasNaBarra(arquivos).achados.map(a => a.item)

describe('barra', () => {
  it('fora da barra: nada a decidir', () => {
    assert.deepEqual(mudancasNaBarra([mudou('src/items/items.service.ts', ['a'], ['b']), mudou('docs/memory/x.md', ['texto'], ['outro texto'])]), { achados: [], semPatch: [] })
  })
  it('a fixture dos testes do harness é barra', () => {
    assert.deepEqual(itens([mudou('scripts/harness/test/fixture.mjs', ['  return root'], ['  return null'])]), ['o gate do CI e do harness'])
  })
  it('o workflow do CI: qualquer linha conta, também a que aperta', () => {
    assert.deepEqual(itens([mudou('.github/workflows/ci.yml', [], ['      - run: pnpm lint --max-warnings 0'])]), ['o gate do CI e do harness'])
  })
  it('o package.json: o script do gate conta; a versão de dependência não', () => {
    assert.equal(itens([mudou('package.json', ['    "check": "pnpm lint && pnpm test",'], ['    "check": "pnpm test",'])]).length, 1)
    assert.deepEqual(itens([mudou('package.json', ['    "vitest": "4.1.10",'], ['    "vitest": "4.1.11",'])]), [])
  })
  it('a regra do motor, o hook e o settings: qualquer mudança; o comentário não', () => {
    assert.deepEqual(itens([mudou('scripts/harness/rules/no-force-push.mjs', ["    if (arg === '--force') return arg"], [])]), ['as regras do motor e os hooks'])
    assert.deepEqual(itens([mudou('scripts/harness/rules/no-force-push.mjs', ['// comentário velho'], ['// comentário novo'])]), [])
    assert.deepEqual(itens([mudou('.claude/hooks/_io.mjs', [' * texto velho do JSDoc'], [' * texto novo do JSDoc'])]), [])
    assert.equal(itens([mudou('.claude/hooks/_io.mjs', [], ['/*'])]).length, 1, 'a abertura de bloco embrulha código')
  })
  it('teste do gate: linha que sai e não volta conta; título renomeado e import não', () => {
    const t = 'scripts/harness/test/check-claims.test.mjs'
    assert.equal(itens([mudou(t, ["    assert.equal(x, 2)"], ["    assert.equal(x, 3)"])]).length, 1)
    assert.deepEqual(itens([mudou(t, ["  it('pega o caso', () => {"], ["  it('pega o caso de borda', () => {"])]), [])
    assert.deepEqual(itens([mudou(t, ["import { a } from '../a.mjs'"], ["import { a, b } from '../a.mjs'"])]), [])
    assert.deepEqual(itens([mudou(t, ['    assert.equal(x, 2)'], ['  // movida para outro it', '    assert.equal(x, 2)'])]), [], 'linha que só mudou de lugar')
  })
  it('pulo de teste novo conta, no harness e no produto; dentro de texto não', () => {
    assert.equal(itens([mudou('src/items/items.service.spec.ts', [], ["  it.skip('cria', () => {"])]).length, 1)
    assert.equal(itens([mudou('scripts/harness/test/x.test.mjs', [], ["  it('x', { skip: true }, () => {"])]).length, 1)
    assert.deepEqual(itens([mudou('scripts/harness/test/x.test.mjs', [], ["  write(root, 'a.mjs', 'it.skip(\"exemplo\")')"])]), [])
  })
  it('texto: o termo que some no saldo conta; a frase que só mudou de arquivo não', () => {
    const sai = mudou('.claude/skills/pre-push/SKILL.md', ['Rode o gate inteiro antes do push.'], [])
    assert.ok(itens([sai]).includes('o gate do CI e do harness'))
    assert.deepEqual(itens([sai, mudou('.claude/skills/validar-antes-de-concluir/SKILL.md', [], ['Rode o gate inteiro antes do push.'])]), [])
    // docs/ e README o agente não lê como regra: o termo que vai para lá não compensa o que saiu da skill.
    assert.ok(itens([sai, mudou('docs/harness.md', [], ['Rode o gate inteiro antes do push.'])]).includes('o gate do CI e do harness'))
    assert.deepEqual(itens([mudou('docs/harness.md', ['a revisão fria lê o diff'], ['a revisão fria lê só o diff'])]), [])
  })
  it('arquivo da barra apagado, renomeado para fora, ou sem diff', () => {
    assert.match(mudancasNaBarra([{ caminho: 'scripts/harness/prove.mjs', status: 'removed', patch: patch(['x'], []) }]).achados[0].motivo, /apagado/)
    assert.match(mudancasNaBarra([{ caminho: 'scripts/old/prove.mjs', anterior: 'scripts/harness/prove.mjs', status: 'renamed', patch: '' }]).achados[0].motivo, /fora da barra/)
    assert.deepEqual(mudancasNaBarra([{ caminho: 'scripts/harness/barra.mjs', status: 'modified' }]).semPatch, ['scripts/harness/barra.mjs'])
  })
  it('CODEOWNERS: dono que entra ou sai conta; ordem e comentário não', () => {
    assert.match(donosMudados(patch(['* @a @b'], ['* @a @b @c'])), /ganhou @c/)
    assert.match(donosMudados(patch(['* @a @b'], ['* @a'])), /perdeu @b/)
    assert.equal(donosMudados(patch(['* @a @b', '# velho'], ['* @b @a', '# novo'])), null)
  })
  it('código da linha: tira o texto entre aspas e mantém o ${} da crase', () => {
    assert.equal(codigoDaLinha("x('it.skip(1)')"), "x('')")
    assert.equal(codigoDaLinha('f(`a ${it.skip} b`)'), 'f(`${it.skip}`)')
  })
  it('do git local: lê a branch contra a base', () => {
    const root = makeRepo()
    git(root, ['add', '-A'])
    git(root, ['commit', '-q', '-m', 'base'])
    git(root, ['switch', '-q', '-c', 'feat/x'])
    write(root, 'scripts/harness/prove.mjs', 'export const x = 1\n')
    git(root, ['add', '-A'])
    git(root, ['commit', '-q', '-m', 'feat: x'])
    const arquivos = arquivosDoGit(root, 'main')
    cleanup(root)
    assert.deepEqual(itens(arquivos), ['a prova por sabotagem'])
  })
})

describe('conferir-fluxo', () => {
  const PONTA = 'abcdef1234567890abcdef1234567890abcdef12'
  const pr = { head: { sha: PONTA }, user: { login: 'dono' } }
  const naBarra = [mudou('scripts/harness/rules/no-force-push.mjs', ['x'], ['y'])]
  const autorizacao = (commit, citacao = '> pode subir') => `**Autorização do merge:**\n\n${citacao}\n\n**Commit:** \`${commit}\``
  it('fora da barra passa sem decisão', () => {
    assert.equal(julgar({ pr, arquivos: [mudou('src/a.ts', ['a'], ['b'])], revisoes: [], comentarios: [] }).ok, true)
  })
  it('na barra sem decisão reprova', () => {
    assert.equal(julgar({ pr, arquivos: naBarra, revisoes: [], comentarios: [] }).ok, false)
  })
  it('revisão aprovada só vale na ponta, de quem não é o autor, de quem tem acesso', () => {
    const rev = extra => ({ state: 'APPROVED', commit_id: PONTA, user: { login: 'outra' }, author_association: 'MEMBER', ...extra })
    assert.equal(julgar({ pr, arquivos: naBarra, revisoes: [rev()], comentarios: [] }).ok, true)
    assert.equal(julgar({ pr, arquivos: naBarra, revisoes: [rev({ commit_id: 'velho' })], comentarios: [] }).ok, false)
    assert.equal(julgar({ pr, arquivos: naBarra, revisoes: [rev({ user: { login: 'Dono' } })], comentarios: [] }).ok, false)
    assert.equal(julgar({ pr, arquivos: naBarra, revisoes: [rev({ author_association: 'NONE' })], comentarios: [] }).ok, false)
  })
  it('autorização do merge: cabeçalho, citação literal e o commit da ponta', () => {
    assert.equal(autorizacaoNaPonta(autorizacao(PONTA.slice(0, 7)), PONTA), true)
    assert.equal(autorizacaoNaPonta(autorizacao('1234567'), PONTA), false)
    assert.equal(autorizacaoNaPonta(autorizacao(PONTA, ''), PONTA), false)
    assert.equal(autorizacaoNaPonta(`pode subir\n**Commit:** ${PONTA}`, PONTA), false)
    const comentario = { body: autorizacao(PONTA), author_association: 'OWNER', user: { login: 'dono' } }
    assert.equal(julgar({ pr, arquivos: naBarra, revisoes: [], comentarios: [comentario] }).ok, true)
    assert.equal(julgar({ pr, arquivos: naBarra, revisoes: [], comentarios: [{ ...comentario, author_association: 'NONE' }] }).ok, false)
  })

  let servidor
  let api
  const pedidos = []
  before(async () => {
    const rotas = {
      '/repos/o/r/pulls/5': pr,
      '/repos/o/r/pulls/5/files': [{ filename: 'scripts/harness/rules/no-force-push.mjs', status: 'modified', patch: patch(['x'], ['y']), changes: 2 }],
      '/repos/o/r/pulls/5/reviews': [],
      '/repos/o/r/issues/5/comments': [{ body: autorizacao(PONTA), author_association: 'OWNER', user: { login: 'dono' } }],
    }
    servidor = createServer((req, res) => {
      const caminho = req.url.split('?')[0]
      pedidos.push({ metodo: req.method, caminho, auth: req.headers.authorization })
      const corpo = rotas[caminho]
      res.writeHead(corpo ? 200 : 404, { 'content-type': 'application/json' })
      res.end(JSON.stringify(corpo ?? { message: 'Not Found' }))
    })
    await new Promise(ok => servidor.listen(0, '127.0.0.1', ok))
    api = `http://127.0.0.1:${servidor.address().port}`
  })
  after(() => servidor.close())

  it('pela API: lê PR, arquivos, revisões e comentários, com o token; aceita a autorização na ponta', async () => {
    const r = await conferirFluxo({ repo: 'o/r', numero: 5, cliente: github({ token: 't0k', api }) })
    assert.equal(r.ok, true)
    assert.ok(pedidos.every(p => p.auth === 'Bearer t0k'))
    assert.deepEqual([...new Set(pedidos.map(p => p.caminho))].sort(), ['/repos/o/r/issues/5/comments', '/repos/o/r/pulls/5', '/repos/o/r/pulls/5/files', '/repos/o/r/pulls/5/reviews'])
  })
  it('pela API: erro de HTTP vira erro com o que conferir', async () => {
    await assert.rejects(conferirFluxo({ repo: 'o/r', numero: 9, cliente: github({ api }) }), /GitHub respondeu 404/)
  })
})
