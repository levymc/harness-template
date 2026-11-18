/**
 * As travas da suíte (scripts/harness/suite.mjs), vistas com um arquivo de teste de mentira —
 * rodar a suíte inteira aqui dentro a rodaria duas vezes.
 */
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, describe, it } from 'node:test'
import { rodarSuite } from '../suite.mjs'
import { limiteEmMb } from '../teto-de-memoria.mjs'
import { TEMPLATE } from './fixture.mjs'

const pastas = []
after(() => pastas.forEach(p => rmSync(p, { recursive: true, force: true })))
function teste(fonte) {
  const pasta = mkdtempSync(join(tmpdir(), 'suite-'))
  pastas.push(pasta)
  const arquivo = join(pasta, 'x.test.mjs')
  writeFileSync(arquivo, ["import { it } from 'node:test'", "import { mkdtempSync, rmSync } from 'node:fs'", "import { tmpdir } from 'node:os'", "import { join } from 'node:path'", fonte].join('\n'))
  return arquivo
}

describe('suite', () => {
  it('teste que cria pasta na Temp e não apaga aparece nas sobras', () => {
    const r = rodarSuite([teste("it('vaza', () => { mkdtempSync(join(tmpdir(), 'esquecida-')) })")], { cwd: TEMPLATE, stdio: 'ignore' })
    assert.equal(r.status, 0)
    assert.equal(r.sobras.length, 1)
    assert.match(r.sobras[0], /^esquecida-/)
  })
  it('teste que apaga o que criou não deixa sobra', () => {
    const r = rodarSuite([teste("it('limpa', () => { rmSync(mkdtempSync(join(tmpdir(), 'x-')), { recursive: true }) })")], { cwd: TEMPLATE, stdio: 'ignore' })
    assert.deepEqual(r.sobras, [])
  })
  it('o vermelho da suíte filha chega ao código de saída', () => {
    assert.notEqual(rodarSuite([teste("it('falha', () => { throw new Error('x') })")], { cwd: TEMPLATE, stdio: 'ignore' }).status, 0)
  })
  it('teto de memória: só aceita inteiro positivo, senão o padrão', () => {
    assert.equal(limiteEmMb('512'), 512)
    assert.equal(limiteEmMb('0'), 2048)
    assert.equal(limiteEmMb('abc'), 2048)
  })
})
