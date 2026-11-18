import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { after, describe, it } from 'node:test'
import { PENDENTE, prove, proveTodas } from '../prove.mjs'
import { cleanup, makeRepo, read, write } from './fixture.mjs'

const repos = []
after(() => repos.forEach(cleanup))
const repo = extra => {
  const root = makeRepo(extra)
  repos.push(root)
  return root
}

// a "verificação" da fixture: verde enquanto guarda.txt disser "bom"
const CMD = `node -e "process.exit(require('fs').readFileSync('guarda.txt','utf8').includes('bom')?0:1)"`

describe('prove', () => {
  const root = repo({ 'guarda.txt': 'estado bom\n' })

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

  // Antes, com a verificação já vermelha, qualquer troca "pegava": a prova provava nada.
  it('recusa quando a verificação já está vermelha sem sabotagem', () => {
    const vermelho = repo({ 'guarda.txt': 'estado ruim\n' })
    assert.throws(() => prove({ file: 'guarda.txt', de: 'estado', para: 'x', cmd: CMD, cwd: vermelho }), /já falha sem sabotagem/)
  })

  it('recusa trecho que aparece mais de uma vez', () => {
    const duplo = repo({ 'guarda.txt': 'bom e bom\n' })
    assert.throws(() => prove({ file: 'guarda.txt', de: 'bom', para: 'x', cmd: CMD, cwd: duplo }), /aparece 2 vezes/)
  })

  it('no arquivo com CRLF, o trecho de várias linhas casa', () => {
    const crlf = repo({ 'guarda.txt': 'linha um\r\nestado bom\r\n' })
    assert.equal(prove({ file: 'guarda.txt', de: 'um\nestado bom', para: 'um\nestado mau', cmd: CMD, cwd: crlf }).pegou, true)
    assert.equal(read(crlf, 'guarda.txt'), 'linha um\r\nestado bom\r\n')
  })

  it('lista: diz qual sobreviveu e qual foi pega', () => {
    const r = proveTodas({ sabotagens: [{ arquivo: 'guarda.txt', de: 'bom', para: 'mau' }, { arquivo: 'guarda.txt', de: 'estado', para: 'x' }], cmd: CMD, cwd: root })
    assert.deepEqual(r.map(x => x.pegou), [true, false])
  })

  it('troca que estoura o tempo conta como pega', () => {
    let n = 0
    const rodarVerificacao = () => (n++ === 0 ? { status: 0, saida: '' } : { status: null, saida: '', estourou: true })
    assert.equal(prove({ file: 'guarda.txt', de: 'bom', para: 'mau', cmd: 'x', cwd: root, rodarVerificacao }).pegou, true)
  })

  it('devolve o arquivo que uma corrida cortada deixou sabotado', () => {
    const cortado = repo({ 'guarda.txt': 'estado bom\n' })
    let n = 0
    // simula o processo morrendo no meio: a segunda corrida "mata" antes do finally
    const morre = () => {
      if (n++ === 0) return { status: 0, saida: '' }
      throw new Error('morreu')
    }
    // o finally devolve o arquivo; para simular a morte de verdade, regrava a sabotagem e o registro à mão
    assert.throws(() => prove({ file: 'guarda.txt', de: 'bom', para: 'mau', cmd: 'x', cwd: cortado, rodarVerificacao: morre }), /morreu/)
    assert.equal(read(cortado, 'guarda.txt'), 'estado bom\n')
    write(cortado, 'guarda.txt', 'estado mau\n')
    write(cortado, PENDENTE, JSON.stringify({ arquivo: 'guarda.txt', de: 'bom', para: 'mau', sabotado: createHash('sha256').update('estado mau\n').digest('hex'), original: Buffer.from('estado bom\n').toString('base64') }))
    const avisos = []
    prove({ file: 'guarda.txt', de: 'bom', para: 'mau', cmd: CMD, cwd: cortado, avisar: m => avisos.push(m) })
    assert.match(avisos[0], /voltou ao original/)
    assert.equal(read(cortado, 'guarda.txt'), 'estado bom\n')
    assert.equal(existsSync(`${cortado}/${PENDENTE}`), false)
  })
})
