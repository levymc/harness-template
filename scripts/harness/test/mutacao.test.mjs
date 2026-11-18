/**
 * O planejamento da mutação do PR: que linhas entram, como se fatiam, que testes cada fatia
 * roda, e a leitura do relatório. A corrida do Stryker em si fica fora daqui (minutos por
 * fatia); ela foi vista rodando e reprovando abaixo do break — ver PROGRESS da tarefa.
 */
import assert from 'node:assert/strict'
import { after, describe, it } from 'node:test'
import { abaixoDoBreak, configDaFatia, desligadasSemMotivo, faixas, fatiar, fatiarPorTestes, linhasAdicionadas, mutavel, planejar, referencias, testesQueUsam } from '../mutacao.mjs'
import { cleanup, git, makeRepo, write } from './fixture.mjs'

const repos = []
after(() => repos.forEach(cleanup))

describe('mutacao', () => {
  it('lê só as linhas adicionadas do diff -U0, com o número do lado novo', () => {
    const diff = ['+++ b/a.mjs', '@@ -1,0 +3,2 @@', '+um', '+dois', '+++ /dev/null', '+fora', '+++ b/b.mjs', '@@ -5 +7 @@', '-velho', '+novo'].join('\n')
    assert.deepEqual([...linhasAdicionadas(diff)], [['a.mjs', [{ numero: 3, texto: 'um' }, { numero: 4, texto: 'dois' }]], ['b.mjs', [{ numero: 7, texto: 'novo' }]]])
  })
  it('mutável: casa um glob positivo e nenhum negativo', () => {
    const globs = ['scripts/harness/**/*.mjs', '!scripts/harness/test/**']
    assert.equal(mutavel('scripts/harness/rules/x.mjs', globs), true)
    assert.equal(mutavel('scripts/harness/test/x.test.mjs', globs), false)
    assert.equal(mutavel('src/a.ts', globs), false)
  })
  it('faixas e fatias cortam a faixa que não cabe', () => {
    assert.deepEqual(faixas([7, 1, 2, 3, 3]), [[1, 3], [7, 7]])
    assert.deepEqual(fatiar(new Map([['a', [1, 2, 3, 4, 5]], ['b', [1]]]), 3), ['a:1-3', 'a:4-5,b:1-1'])
  })
  it('recusa Stryker desligado sem motivo', () => {
    const linhas = new Map([['a.mjs', [{ numero: 1, texto: '// Stryker disable next-line all' }, { numero: 2, texto: '// Stryker disable next-line all: o prefixo é só nome' }]]])
    assert.deepEqual(desligadasSemMotivo(linhas), ['a.mjs:1'])
  })
  it('referências: import relativo e script citado com pasta (o teste que roda o hook)', () => {
    const caminhos = ['scripts/harness/a.mjs', 'scripts/harness/b.mjs', '.claude/hooks/bash-guard.mjs', 'scripts/harness/test/x.test.mjs']
    const texto = "import { a } from '../a.mjs'\nrun('.claude/hooks/bash-guard.mjs')"
    assert.deepEqual([...referencias('scripts/harness/test/x.test.mjs', texto, caminhos)].sort(), ['.claude/hooks/bash-guard.mjs', 'scripts/harness/a.mjs'])
  })
  // A regra do motor é testada pelo catálogo que a importa: só o uso direto a deixaria "sem teste".
  it('testes que usam: segue o import transitivo, sem laço', () => {
    const grafo = new Map([
      ['t/x.test.mjs', new Set(['catalog.mjs'])],
      ['t/y.test.mjs', new Set(['outro.mjs'])],
      ['catalog.mjs', new Set(['regra.mjs'])],
      ['regra.mjs', new Set(['catalog.mjs'])],
      ['outro.mjs', new Set()],
    ])
    assert.deepEqual(testesQueUsam(['regra.mjs'], grafo), ['t/x.test.mjs'])
    assert.deepEqual(testesQueUsam(['nada.mjs'], grafo), [])
    assert.deepEqual(fatiarPorTestes(new Map([['regra.mjs', [1]], ['outro.mjs', [1]]]), grafo, 60), ['regra.mjs:1-1', 'outro.mjs:1-1'])
  })
  it('abaixo do break: por arquivo, contando timeout como pego e sem cobertura como vivo', () => {
    const relatorio = { thresholds: { break: 80 }, files: {
      'bom.mjs': { mutants: [{ status: 'Killed' }, { status: 'Timeout' }, { status: 'Killed' }, { status: 'Killed' }, { status: 'Survived' }] },
      'fraco.mjs': { mutants: [{ status: 'Killed' }, { status: 'NoCoverage' }, { status: 'Ignored' }] },
      'vazio.mjs': { mutants: [{ status: 'Ignored' }] },
    } }
    assert.deepEqual(abaixoDoBreak(relatorio), [{ arquivo: 'fraco.mjs', placar: 50 }])
  })
  it('a config da fatia do harness roda só os testes dela, com o teto de memória', () => {
    const c = configDaFatia({ $comentario: 'x', mutate: ['*'] }, 'harness', 'a.mjs:1-2', ['t/x.test.mjs'])
    assert.deepEqual(c.mutate, ['a.mjs:1-2'])
    assert.equal(c.$comentario, undefined)
    assert.match(c.commandRunner.command, /--import "\.\/scripts\/harness\/teto-de-memoria\.mjs" --test "t\/x\.test\.mjs"$/)
    assert.equal(configDaFatia({ mutate: [] }, 'produto', 'src/a.ts:1-2').commandRunner, undefined)
  })
  it('planejar: fatia por alvo só as linhas novas em arquivo mutável', () => {
    const root = makeRepo({
      'stryker.config.json': JSON.stringify({ mutate: ['scripts/**/*.mjs', '!scripts/**/*.test.mjs'] }),
      'stryker.produto.config.json': JSON.stringify({ mutate: ['src/**/*.ts'] }),
      'scripts/lib.mjs': 'export const x = 1\n',
      'scripts/lib.test.mjs': "import { x } from './lib.mjs'\n",
    })
    repos.push(root)
    git(root, ['add', '-A'])
    git(root, ['commit', '-q', '-m', 'base'])
    git(root, ['switch', '-q', '-c', 'feat/x'])
    write(root, 'scripts/lib.mjs', 'export const x = 1\nexport const y = 2\n')
    write(root, 'src/a.ts', 'export const a = process.env.FOO // âncora-viva\nexport const b = 2\n')
    write(root, 'docs/x.md', 'texto\n')
    git(root, ['add', '-A'])
    git(root, ['commit', '-q', '-m', 'feat: y'])
    const { codigo, matriz } = planejar(root, 'main')
    assert.equal(codigo, 0)
    assert.deepEqual(matriz, [{ fatia: 1, alvo: 'harness', arquivos: 'scripts/lib.mjs:2-2' }, { fatia: 2, alvo: 'produto', arquivos: 'src/a.ts:2-2' }])
  })
})
