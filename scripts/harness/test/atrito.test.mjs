/**
 * O loop de atrito: a leitura da sessão (com o segredo mascarado), o relato que só aceita o que
 * está na sessão, a triagem que só aceita defeito com teste vermelho, e a auditoria do ritual.
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { comentarioDaTriagem, corpoDoAtrito, fila, vermelho } from '../atrito.mjs'
import { conferirSessao } from '../conferir-sessao.mjs'
import { lerSessao, mascarar, pastaDoProjeto, trecho, turnosDoTrecho } from '../sessao.mjs'

const RAIZ = '/repo'
const linha = (type, content, extra = {}) => JSON.stringify({ type, sessionId: 's1', timestamp: '2026-01-01T10:00:00Z', message: { role: type, content }, ...extra })
const pessoa = texto => linha('user', texto, { origin: { kind: 'human' } })
const agente = texto => linha('assistant', [{ type: 'text', text: texto }])
const usa = (name, input) => linha('assistant', [{ type: 'tool_use', id: 'x', name, input }])
const resultado = texto => linha('user', [{ type: 'tool_result', tool_use_id: 'x', content: texto }])
const sessao = (...linhas) => lerSessao(linhas.join('\n'))
const edita = arquivo => usa('Edit', { file_path: `${RAIZ}/${arquivo}`, old_string: 'a', new_string: 'b' })

describe('sessao', () => {
  it('numera os turnos de pessoa, agente, ferramenta e resultado; pula meta, subagente e linha ilegível', () => {
    const s = lerSessao([pessoa('oi'), linha('user', 'injetado', { isMeta: true }), agente('olá'), usa('Bash', { command: 'ls' }), resultado('a.txt'), linha('assistant', [{ type: 'text', text: 'do subagente' }], { isSidechain: true }), '{quebrado'].join('\n'))
    assert.deepEqual(s.turnos.map(t => t.quem), ['pessoa', 'agente', 'ferramenta', 'resultado'])
    assert.equal(s.turnos[2].ferramenta, 'Bash')
    assert.equal(s.ilegiveis, 1)
    assert.equal(s.id, 's1')
  })
  it('aviso da ferramenta num registro de usuário não é fala da pessoa', () => {
    assert.equal(lerSessao(linha('user', '<system-reminder>x</system-reminder>')).turnos[0].quem, 'aviso')
  })
  it('mascara as formas comuns de segredo e deixa o texto comum', () => {
    const casos = [
      ['token ghp_abcdefghijklmnopqrstuvwxyz0123', 'token [mascarado]'],
      ['DATABASE_URL=postgres://app:senha@db/app', 'DATABASE_URL=[mascarado]'],
      ['Authorization: Bearer abc.def.ghi', 'Authorization: Bearer [mascarado]'],
      ['curl https://user:pw@host/x', 'curl https://[mascarado]@host/x'],
      ['"api_key": "xyz123"', '"api_key": "[mascarado]"'],
      ['fale com fulano@empresa.com.br', 'fale com [mascarado]'],
      ['?token=abc&x=1', '?token=[mascarado]&x=1'],
    ]
    for (const [de, para] of casos) assert.equal(mascarar(de), para, de)
    assert.equal(mascarar('const token = lerToken() // git@github.com:x/y'), 'const token = lerToken() // git@github.com:x/y')
  })
  it('trecho: só os turnos pedidos, mascarados; recusa turno fora da sessão', () => {
    const s = sessao(pessoa('primeiro'), agente('SECRET_KEY=abc'), pessoa('terceiro'))
    const md = trecho(s, '2')
    assert.match(md, /### Turno 2 · agente[\s\S]*SECRET_KEY=\[mascarado\]/)
    assert.doesNotMatch(md, /primeiro|terceiro|abc/)
    assert.throws(() => turnosDoTrecho(3, '2-5'), /tem 3 turnos/)
    assert.deepEqual(turnosDoTrecho(9, '1-2,5'), [1, 2, 5])
  })
  it('a pasta do projeto troca todo caractere fora de [a-zA-Z0-9] por hífen, como o Claude Code', () => {
    assert.equal(pastaDoProjeto('C:\\Users\\a b\\repo'), 'C--Users-a-b-repo')
  })
})

describe('atrito', () => {
  const s = sessao(pessoa('roda o check'), usa('Bash', { command: 'pnpm check' }), resultado('[cited-path] docs/x.md cita src/sumiu.ts'))
  const spec = { titulo: 'check acusa caminho de exemplo', onde: 'check-claims:cited-path', visto: [{ turno: 3, trecho: 'docs/x.md cita src/sumiu.ts' }], deduzido: 'o exemplo usa caminho real', esperado: 'aceitar marcador de modelo' }
  it('monta o corpo com o visto literal, o deduzido e o esperado', () => {
    const corpo = corpoDoAtrito(spec, s)
    assert.match(corpo, /## Visto na sessão[\s\S]*Turno 3 da sessão s1[\s\S]*docs\/x\.md cita src\/sumiu\.ts[\s\S]*## Deduzido[\s\S]*## O que devia/)
  })
  it('recusa citação que não está no turno (reescrita de memória) e visto vazio', () => {
    assert.throws(() => corpoDoAtrito({ ...spec, visto: [{ turno: 3, trecho: 'o check quebrou' }] }, s), /não está no turno 3/)
    assert.throws(() => corpoDoAtrito({ ...spec, visto: [{ turno: 9, trecho: 'x' }] }, s), /não tem o turno 9/)
    assert.throws(() => corpoDoAtrito({ ...spec, visto: [] }, s), /falta "visto"/)
  })
  it('recusa relato com cara de segredo', () => {
    assert.throws(() => corpoDoAtrito({ ...spec, deduzido: 'usei API_TOKEN=abc123' }, s), /cara de segredo/)
  })
  it('a fila vem do gh, a issue mais antiga primeiro; sem gh, diz o que fazer', () => {
    const gh = () => JSON.stringify([{ number: 2, title: 'b', createdAt: '2026-02-01T00:00:00Z' }, { number: 1, title: 'a', createdAt: '2026-01-01T00:00:00Z' }])
    assert.deepEqual(fila(gh).map(i => i.number), [1, 2])
    assert.throws(() => fila(() => { throw new Error('gh: command not found') }), /label "atrito"/)
  })
})

describe('triagem', () => {
  const base = { issue: 7, classe: 'script', reproduzido: { resultado: 'sim', como: 'rodei na main' }, causa: 'regex', correcao: { arquivo: 'scripts/harness/x.mjs', teste: 'x.test.mjs', vermelho: 'not ok 1 - pega o caso\n# fail 1' } }
  it('aceita defeito com teste vermelho e monta o comentário', () => {
    assert.match(comentarioDaTriagem(base), /\*\*Classe:\*\* script[\s\S]*Correção proposta[\s\S]*# fail 1/)
  })
  it('recusa defeito sem o vermelho do teste novo: saída verde não prova o defeito', () => {
    assert.throws(() => comentarioDaTriagem({ ...base, correcao: { ...base.correcao, vermelho: '# pass 3\n# fail 0' } }), /não está vermelho/)
    assert.throws(() => comentarioDaTriagem({ ...base, correcao: { arquivo: 'x', teste: 'y' } }), /correcao\.vermelho/)
  })
  it('fora do harness pede o destino, não a correção; classe fora da lista é recusada', () => {
    assert.match(comentarioDaTriagem({ ...base, classe: 'fora do harness', correcao: undefined, destino: 'o time do produto' }), /Vai para:\*\* o time do produto/)
    assert.throws(() => comentarioDaTriagem({ ...base, classe: 'palpite' }), /fora da lista/)
  })
  it('vermelho: reconhece falha de node:test, vitest e oxlint; não confunde com zero falhas', () => {
    for (const s of ['# fail 2', 'not ok 3 - x', 'Tests  1 failed | 4 passed', '✖ 2 problems', 'AssertionError [ERR_ASSERTION]']) assert.equal(vermelho(s), true, s)
    for (const s of ['# fail 0', '✖ 0 problems', 'Tests  4 passed (4)', '']) assert.equal(vermelho(s), false, s)
  })
})

describe('conferir-sessao', () => {
  const faltas = (...linhas) => conferirSessao(sessao(...linhas), RAIZ).map(f => f.falta)
  const resumoOk = agente('Pronto. O que não foi verificado: o e2e, sem banco.')
  it('sessão no ritual não tem falta', () => {
    assert.deepEqual(faltas(usa('Skill', { skill: 'iniciar-tarefa' }), edita('src/a.ts'), edita('src/b.ts'), edita('src/c.ts'), usa('Skill', { skill: 'pre-push' }), usa('Bash', { command: 'git push -u origin feat/x' }), resumoOk), [])
  })
  it('3 edições sem tarefa aberta antes da primeira', () => {
    assert.deepEqual(faltas(edita('src/a.ts'), edita('src/b.ts'), edita('src/c.ts'), resumoOk), ['tarefa-antes-da-edicao'])
    assert.deepEqual(faltas(edita('src/a.ts'), edita('src/b.ts'), resumoOk), [], 'duas edições é trabalho pequeno')
    assert.deepEqual(faltas(usa('Read', { file_path: `${RAIZ}/work/t/task.json` }), edita('src/a.ts'), edita('src/b.ts'), edita('src/c.ts'), resumoOk), [], 'continuar tarefa aberta conta')
  })
  it('push sem validar antes', () => {
    assert.deepEqual(faltas(usa('Bash', { command: 'git -C . push origin feat/x' }), usa('Skill', { skill: 'pre-push' })), ['validacao-antes-do-push'])
    // Visto na primeira rodada contra uma sessão real: a regex acusava o commit que citava o push.
    assert.deepEqual(faltas(usa('Bash', { command: 'git commit -m "antes, bash -c \\"git push --force\\" passava"' })), [], 'push citado na mensagem é dado')
  })
  it('passa:true sem evidência no PROGRESS', () => {
    const marca = usa('Edit', { file_path: `${RAIZ}/work/t/task.json`, old_string: 'false', new_string: '"passa": true' })
    assert.deepEqual(faltas(marca), ['evidencia-do-criterio'])
    assert.deepEqual(faltas(marca, usa('Edit', { file_path: `${RAIZ}/work/t/PROGRESS.md`, old_string: 'x', new_string: '- evidência (critério 1): verde' })), [])
  })
  it('resumo final sem o que não foi verificado, só quando a sessão editou', () => {
    assert.deepEqual(faltas(edita('src/a.ts'), agente('Pronto, tudo certo.')), ['resumo-com-nao-verificado'])
    assert.deepEqual(faltas(agente('Respondi a pergunta.')), [])
  })
})
