/**
 * As peças da skill validar-antes-de-concluir e da cobrir-lacunas-de-teste: a parada na
 * segunda falha igual, o pedido da revisão fria (o que entra e o que fica de fora) e o recorte.
 */
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { after, describe, it } from 'node:test'
import { decidir, mesmaFalha, normalizar, rascunhoDoBloqueio, registrar } from '../falhas.mjs'
import { recorte } from '../recorte.mjs'
import { gerarPedido, lenteDoPr, lerAchados, LIMITE_DA_SAIDA, montarPedido, cortarSaida, NADA } from '../revisao-fria.mjs'
import { cleanup, git, makeRepo, read, run, write } from './fixture.mjs'

const repos = []
after(() => repos.forEach(cleanup))
const repo = extra => {
  const root = makeRepo(extra)
  repos.push(root)
  return root
}

describe('falhas', () => {
  const falha = (mensagem, tentativa = 't') => ({ resultado: 'falhou', teste: 'build', mensagem, tentativa })
  it('a mesma falha duas vezes seguidas manda parar, mesmo com hora e duração diferentes', () => {
    let h = registrar([], falha('erro em 2026-01-01T10:00:00Z depois de 31ms'))
    assert.equal(decidir(h).parar, false)
    h = registrar(h, falha('erro em 2026-01-02T11:00:00Z depois de 2 s'))
    assert.equal(decidir(h).parar, true)
  })
  it('falha diferente ou um passou no meio zera a contagem', () => {
    const h = [falha('a'), { resultado: 'passou' }, falha('a')].reduce(registrar, [])
    assert.equal(decidir(h).parar, false)
    assert.equal(decidir([falha('a'), falha('b')].reduce(registrar, [])).parar, false)
  })
  it('recusa tentativa sem o que mudou: sem isso a tentativa repetida não aparece', () => {
    assert.throws(() => registrar([], { resultado: 'falhou', teste: 'x', mensagem: 'y' }), /--tentativa/)
  })
  it('normaliza endereço de memória e espaço', () => {
    assert.equal(normalizar('em 0xdeadbeef   agora'), 'em <endereço> agora')
  })
  // Saída exata, padrão por padrão: a mutação mostrou que "a mesma falha com hora diferente"
  // não distinguia uma regex trocada de uma certa.
  it('normaliza cada forma de hora, duração e endereço, por inteiro', () => {
    assert.equal(normalizar('a 2026-01-02T10:11:12.345+03:00 b'), 'a <hora> b')
    assert.equal(normalizar('a 2026-01-02 10:11:12Z b'), 'a <hora> b')
    assert.equal(normalizar('a 10:11:12,5 b'), 'a <hora> b')
    assert.equal(normalizar('levou 1.5s e 200 ms e 3,25 s'), 'levou <duração> e <duração> e <duração>')
    assert.equal(normalizar('em 0xABC1'), 'em <endereço>')
    assert.equal(normalizar('  linha\n\tquebrada  '), 'linha quebrada')
    assert.equal(normalizar(undefined), '')
    assert.equal(normalizar('versão 12 de 2026'), 'versão 12 de 2026')
  })
  it('mesma falha exige os dois falhou, o mesmo teste (sem contar espaço) e a mesma mensagem', () => {
    const a = { resultado: 'falhou', teste: ' build ', mensagem: 'x', tentativa: 't' }
    assert.equal(mesmaFalha(a, { ...a, teste: 'build' }), true)
    assert.equal(mesmaFalha(a, { ...a, teste: 'lint' }), false)
    assert.equal(mesmaFalha(a, { ...a, mensagem: 'y' }), false)
    assert.equal(mesmaFalha(a, { resultado: 'passou' }), false)
    assert.equal(mesmaFalha({ resultado: 'passou' }, a), false)
    assert.equal(mesmaFalha(undefined, a), false)
  })
  it('registrar guarda o evento aparado e recusa cada campo vazio com a mensagem dele', () => {
    assert.deepEqual(registrar([], { resultado: 'passou', teste: 'ignorado' }), [{ resultado: 'passou' }])
    assert.deepEqual(registrar([{ resultado: 'passou' }], falha('  m  ', '  t  ')), [{ resultado: 'passou' }, { resultado: 'falhou', teste: 'build', mensagem: 'm', tentativa: 't' }])
    assert.throws(() => registrar([], { ...falha('m'), teste: '   ' }), /falta --teste/)
    assert.throws(() => registrar([], { ...falha('m'), mensagem: '' }), /falta --mensagem/)
    assert.throws(() => registrar([], { ...falha('m'), resultado: 'quebrou' }), /resultado desconhecido: "quebrou"/)
  })
  it('decidir: sem falha no fim não para; conta só a sequência do fim e devolve só ela', () => {
    assert.deepEqual(decidir([]), { parar: false, repeticoes: 0 })
    assert.deepEqual(decidir([falha('a'), { resultado: 'passou' }].reduce(registrar, [])), { parar: false, repeticoes: 0 })
    const h = [falha('b', 'antes'), falha('a', 'um'), falha('a', 'dois'), falha('a', 'três')].reduce(registrar, [])
    const d = decidir(h)
    assert.equal(d.repeticoes, 3)
    assert.equal(d.parar, true)
    assert.deepEqual(d.tentativas.map(t => t.tentativa), ['um', 'dois', 'três'])
    assert.equal(d.falha.tentativa, 'três')
    assert.equal(decidir([falha('a')].reduce(registrar, [])).repeticoes, 1)
  })
  it('pela linha de comando: sai 3 na segunda falha igual e grava o rascunho do bloqueio', () => {
    const root = repo()
    const args = ['falhou', '--teste', 'build', '--mensagem', 'TS2307', '--tentativa', 'troquei o import']
    assert.equal(run('scripts/harness/falhas.mjs', { root, args }).code, 0)
    const r = run('scripts/harness/falhas.mjs', { root, args })
    assert.equal(r.code, 3)
    assert.match(r.err, /PARE/)
    assert.match(read(root, '.harness/tentativas.bloqueio.md'), /BLOQUEADO em build[\s\S]*troquei o import/)
  })
  it('recusa opção desconhecida', () => {
    assert.equal(run('scripts/harness/falhas.mjs', { root: repo(), args: ['passou', '--registor', 'x'] }).code, 1)
  })
  it('o rascunho lista o que já foi tentado', () => {
    const d = decidir([falha('a', 'primeira'), falha('a', 'segunda')].reduce(registrar, []))
    assert.match(rascunhoDoBloqueio(d, '2026-01-01'), /1\. primeira\n {2}2\. segunda/)
  })
})

describe('revisao-fria', () => {
  const entrada = { criterio: 'faz x', diff: 'diff --git a/x b/x\n@@ -1 +1 @@\n-a\n+b', saidas: [{ comando: 'pnpm test', texto: 'ok' }] }
  it('monta o pedido com critério, decisões, diff e saída', () => {
    const p = montarPedido({ ...entrada, decisoes: '- padrão 10' })
    for (const trecho of ['## Critério de aceite', 'faz x', '- padrão 10', '+b', 'pnpm test']) assert.ok(p.includes(trecho), trecho)
  })
  it('recusa entrada a mais (conversa, raciocínio) e entrada que falta', () => {
    assert.throws(() => montarPedido({ ...entrada, conversa: 'eu achei que' }), /tire "conversa"/)
    assert.throws(() => montarPedido({ ...entrada, saidas: [] }), /saída do gate/)
    assert.throws(() => montarPedido({ ...entrada, diff: 'não é diff' }), /não parece saída de git diff/)
  })
  it('corta a saída longa pelo começo e mantém o fim (onde fica o resumo)', () => {
    const longa = `${'linha\n'.repeat(LIMITE_DA_SAIDA)}RESUMO: 3 falhas`
    const cortada = cortarSaida(longa, 'gate.txt')
    assert.ok(cortada.length < longa.length)
    assert.match(cortada, /^\[cortado[\s\S]*gate\.txt[\s\S]*RESUMO: 3 falhas$/)
  })
  it('lente nativa só com commit feat', () => {
    assert.equal(lenteDoPr(['feat(x): a', 'fix: b']).aplica, true)
    assert.equal(lenteDoPr(['fix: b']).aplica, false)
  })
  it('aceita só achado com arquivo e linha, ou Nada a apontar', () => {
    assert.deepEqual(lerAchados(NADA), [])
    assert.deepEqual(lerAchados('- src/a.ts:12 — erro'), [{ arquivo: 'src/a.ts', linha: 12, ate: undefined, oQue: 'erro' }])
    assert.throws(() => lerAchados('- o código está estranho'), /sem arquivo e linha/)
    assert.throws(() => lerAchados('Parece bom.'), /fora do formato/)
  })
  it('do repositório: critério do task.json, diff dos commits sem work/ nem .harness/', () => {
    const root = repo({ 'work/t/task.json': JSON.stringify({ objetivo: 'objetivo da tarefa', criterios: [{ descricao: 'critério um', passa: false }] }), 'work/t/PROGRESS.md': 'x', '.harness/gate.txt': 'tudo verde' })
    git(root, ['add', '-A'])
    git(root, ['commit', '-q', '-m', 'base'])
    git(root, ['switch', '-q', '-c', 'feat/x'])
    write(root, 'src/a.ts', 'export const a = 2 // âncora-viva\n')
    write(root, 'work/t/PROGRESS.md', 'RACIOCÍNIO PRIVADO')
    git(root, ['add', '-A'])
    git(root, ['commit', '-q', '-m', 'feat: muda a'])
    const { pedido, lente } = gerarPedido({ tarefa: 'work/t', base: 'main', saidas: [{ comando: 'pnpm check', arquivo: '.harness/gate.txt' }] }, root)
    assert.match(pedido, /objetivo da tarefa[\s\S]*critério um/)
    assert.match(pedido, /\+export const a = 2/)
    assert.doesNotMatch(pedido, /RACIOCÍNIO PRIVADO/)
    assert.equal(lente.aplica, false, 'sem o texto da lente no repositório, ela não entra')
  })
  it('recusa mudança fora de commit: o revisor aprovaria o que não viu', () => {
    const root = repo({ 'work/t/task.json': JSON.stringify({ objetivo: 'o', criterios: [{ descricao: 'c', passa: false }] }), 'work/t/PROGRESS.md': 'x' })
    git(root, ['add', '-A'])
    git(root, ['commit', '-q', '-m', 'base'])
    write(root, 'src/a.ts', 'mudou sem commit\n')
    assert.throws(() => gerarPedido({ tarefa: 'work/t', base: 'main', saidas: [] }, root), /fora de commit[\s\S]*src\/a\.ts/)
    assert.equal(existsSync(`${root}/.harness/revisao-fria.md`), false)
  })
})

describe('recorte', () => {
  it('separa código sem teste, código com teste não mudado e o par mudado junto', () => {
    const root = repo({ 'src/b.ts': 'export const b = 1\n', 'test/b.spec.ts': "import { b } from '../src/b'\n", 'src/c.ts': 'export const c = 1\n', 'test/c.spec.ts': "import { c } from '../src/c'\n" })
    git(root, ['add', '-A'])
    git(root, ['commit', '-q', '-m', 'base'])
    git(root, ['switch', '-q', '-c', 'feat/x'])
    write(root, 'src/a.ts', 'export const a = 3\n')
    write(root, 'src/b.ts', 'export const b = 2\n')
    write(root, 'src/c.ts', 'export const c = 2\n')
    write(root, 'test/c.spec.ts', "import { c } from '../src/c'\n// novo\n")
    write(root, 'docs/x.md', 'texto\n')
    git(root, ['add', '-A'])
    git(root, ['commit', '-q', '-m', 'feat: muda'])
    const r = recorte({ raiz: root, base: 'main' })
    assert.deepEqual(r.semTeste, ['src/a.ts'])
    assert.deepEqual(r.semTesteNovo, ['src/b.ts'])
    assert.deepEqual(r.testesMudados, ['test/c.spec.ts'])
    assert.ok(r.outros.includes('docs/x.md'))
  })
})
