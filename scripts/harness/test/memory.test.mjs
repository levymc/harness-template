/**
 * O ciclo de vida de um fato: criado, verificado, ficando suspeito quando o código citado
 * muda, e renovado. Roda o CLI de verdade, com a fixture como raiz.
 */
import assert from 'node:assert/strict'
import { after, describe, it } from 'node:test'
import { suspects } from '../memory.mjs'
import { cleanup, git, makeRepo, read, run, write } from './fixture.mjs'

const repos = []
function repo() {
  const root = makeRepo()
  repos.push(root)
  git(root, ['add', '-A'])
  git(root, ['commit', '-q', '-m', 'base'])
  return root
}
after(() => repos.forEach(cleanup))

describe('suspeitos (staleness por mudança de código)', () => {
  it('fato verificado DEPOIS do último commit do arquivo citado não é suspeito', () => {
    const root = repo()
    write(root, 'docs/memory/fato-ok.md', read(root, 'docs/memory/fato-ok.md').replace('verified: 2000-01-01', 'verified: 2999-01-01'))
    git(root, ['commit', '-qam', 'renova'])
    assert.deepEqual(suspects(root), [])
  })
  it('arquivo citado commitado depois da verificação torna o fato suspeito', () => {
    const root = repo() // verified: 2000-01-01, commit de hoje
    assert.equal(suspects(root)[0]?.slug, 'fato-ok')
    assert.match(suspects(root)[0].quando, /commit em/)
  })
  it('arquivo citado alterado e não commitado também', () => {
    const root = repo()
    write(root, 'docs/memory/fato-ok.md', read(root, 'docs/memory/fato-ok.md').replace('verified: 2000-01-01', 'verified: 2999-01-01'))
    git(root, ['commit', '-qam', 'renova'])
    write(root, 'src/a.ts', `${read(root, 'src/a.ts')}// mexi\n`)
    assert.match(suspects(root)[0]?.quando ?? '', /não commitado/)
  })
})

describe('suspeitos: arquivo novo', () => {
  it('arquivo citado ainda não versionado (repositório novo) não é suspeito', () => {
    const root = makeRepo() // sem commit: tudo é "??"
    repos.push(root)
    assert.deepEqual(suspects(root), [])
  })
})

describe('CLI', () => {
  it('new cria um esqueleto que o lint RECUSA até ser preenchido', () => {
    const root = repo()
    assert.equal(run('scripts/harness/memory.mjs', { root, args: ['new', 'novo-fato', '--type', 'gotcha'] }).code, 0)
    run('scripts/harness/memory.mjs', { root, args: ['index'] })
    const lint = run('scripts/harness/memory.mjs', { root, args: ['lint'] })
    assert.equal(lint.code, 1)
    assert.match(lint.err, /novo-fato/)
  })
  it('new recusa duplicar um fato existente', () => {
    const r = run('scripts/harness/memory.mjs', { root: repo(), args: ['new', 'fato-ok', '--type', 'gotcha'] })
    assert.equal(r.code, 1)
    assert.match(r.err, /já existe/)
  })
  it('touch renova verified e tira o fato da lista de suspeitos', () => {
    const root = repo()
    assert.equal(suspects(root).length, 1)
    run('scripts/harness/memory.mjs', { root, args: ['touch', 'fato-ok'] })
    git(root, ['commit', '-qam', 'touch'])
    assert.deepEqual(suspects(root), [])
  })
  it('lint passa na fixture e o verify não falha (aviso, não erro)', () => {
    const root = repo()
    assert.equal(run('scripts/harness/memory.mjs', { root, args: ['lint'] }).code, 0)
    const v = run('scripts/harness/memory.mjs', { root, args: ['verify'] })
    assert.equal(v.code, 0)
    assert.match(v.out, /fato-ok/)
  })
})
