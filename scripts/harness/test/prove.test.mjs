import assert from 'node:assert/strict'
import { after, describe, it } from 'node:test'
import { prove } from '../prove.mjs'
import { cleanup, makeRepo, read, write } from './fixture.mjs'

const repos = []
after(() => repos.forEach(cleanup))

// a "verificação" da fixture: verde enquanto guarda.txt disser "bom"
const CMD = `node -e "process.exit(require('fs').readFileSync('guarda.txt','utf8').includes('bom')?0:1)"`

describe('prove', () => {
  const root = makeRepo({ 'guarda.txt': 'estado bom\n' })
  repos.push(root)

  it('mutação que quebra a guarda → pegou, e o arquivo volta ao original', () => {
    const r = prove({ file: 'guarda.txt', de: 'bom', para: 'ruim', cmd: CMD, cwd: root })
    assert.equal(r.pegou, true)
    assert.equal(read(root, 'guarda.txt'), 'estado bom\n')
  })

  it('mutação que não muda nada → NÃO pegou (a guarda seria decoração)', () => {
    assert.equal(prove({ file: 'guarda.txt', de: 'estado', para: 'situação', cmd: CMD, cwd: root }).pegou, false)
    assert.equal(read(root, 'guarda.txt'), 'estado bom\n')
  })

  it('recusa trecho que não existe, em vez de rodar sem mutar e "provar" nada', () => {
    write(root, 'outro.txt', 'x')
    assert.throws(() => prove({ file: 'outro.txt', de: 'inexistente', cmd: CMD, cwd: root }), /não aparece/)
  })
})
