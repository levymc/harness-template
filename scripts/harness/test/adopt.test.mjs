/**
 * Adoção num repositório existente: nada sobrescrito, e o repositório adotado fica
 * consistente — o único vermelho que sobra é o dos marcadores `pendente`, que a skill
 * adotar-harness resolve com o usuário. Roda o check-claims COPIADO para o destino.
 */
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { after, describe, it } from 'node:test'
import { spawnSync } from 'node:child_process'
import { cleanup, git, run, TEMPLATE } from './fixture.mjs'
import { lockDaCamada } from '../adopt.mjs'

describe('lockDaCamada', () => {
  it('tira do lock a skill de terceiro excluída da camada e mantém as outras', () => {
    const lock = JSON.stringify({ $comentario: 'x', skills: { fica: { ref: 'a' }, sai: { ref: 'b' } } })
    const r = JSON.parse(lockDaCamada(lock, path => path === '.claude/skills/sai'))
    assert.deepEqual(Object.keys(r.skills), ['fica'])
    assert.equal(r.$comentario, 'x')
  })
})

// Num repositório que ADOTOU o harness, estes testes não se aplicam: a origem não é o template.
const ehTemplate = JSON.parse(readFileSync(resolve(TEMPLATE, 'harness.config.json'), 'utf8')).template === true
const naoTemplate = !ehTemplate && 'só roda no harness-template'

const dirs = []
function projetoExistente() {
  const dest = mkdtempSync(resolve(tmpdir(), 'harness-adopt-'))
  dirs.push(dest)
  writeFileSync(resolve(dest, 'CLAUDE.md'), '# instruções que alguém escreveu\n')
  writeFileSync(resolve(dest, 'package.json'), JSON.stringify({ name: 'legado', scripts: { test: 'echo ok', memory: 'meu-script' } }, null, 2))
  writeFileSync(resolve(dest, '.gitignore'), 'node_modules/')
  mkdirSync(resolve(dest, 'docs/memory'), { recursive: true })
  writeFileSync(resolve(dest, 'docs/memory/fato-antigo.md'), '---\nname: fato-antigo\ndescription: d\nmetadata:\n  type: project\n---\n\nalgo\n')
  return dest
}
after(() => dirs.forEach(cleanup))

describe('adopt --dry-run', { skip: naoTemplate }, () => {
  it('relata e não escreve nada', () => {
    const dest = projetoExistente()
    const r = run('scripts/harness/adopt.mjs', { args: [dest, '--dry-run'] })
    assert.equal(r.code, 0, r.err)
    assert.match(r.out, /CONFLITO {2}CLAUDE\.md/)
    assert.deepEqual(readdirSync(dest).sort(), ['.gitignore', 'CLAUDE.md', 'docs', 'package.json'])
    assert.deepEqual(readdirSync(resolve(dest, 'docs/memory')), ['fato-antigo.md'])
  })
})

describe('adopt', { skip: naoTemplate }, () => {
  const dest = projetoExistente()
  const r = run('scripts/harness/adopt.mjs', { args: [dest] })
  const ler = path => readFileSync(resolve(dest, path), 'utf8')

  it('termina com sucesso', () => assert.equal(r.code, 0, r.err))

  it('nunca sobrescreve: o existente fica, o nosso vira .harness-proposto', () => {
    assert.equal(ler('CLAUDE.md'), '# instruções que alguém escreveu\n')
    assert.match(ler('CLAUDE.md.harness-proposto'), /@AGENTS\.md/)
  })

  it('acrescenta só os scripts que faltam ao package.json', () => {
    const pkg = JSON.parse(ler('package.json'))
    assert.equal(pkg.scripts.memory, 'meu-script')
    assert.match(pkg.scripts['harness:check'], /check-claims/)
  })

  it('não leva termos proibidos nem as regras do esqueleto', () => {
    const config = JSON.parse(ler('harness.config.json'))
    assert.deepEqual(config.forbiddenTerms, [])
    assert.ok(config.checks.disabled.includes('no-sync'))
  })

  it('não leva as skills que são só do template/esqueleto', () => {
    assert.ok(!existsSync(resolve(dest, '.claude/skills/novo-modulo')))
    assert.ok(!existsSync(resolve(dest, '.claude/skills/novo-repositorio')))
    assert.match(ler('.claude/skills/pre-push/SKILL.md'), /<!-- pendente/)
  })

  it('abre a própria adoção como tarefa em work/', () => {
    const [tarefa] = readdirSync(resolve(dest, 'work')).filter(n => n.endsWith('adotar-harness'))
    const task = JSON.parse(ler(`work/${tarefa}/task.json`))
    assert.ok(task.criterios.some(c => /CLAUDE\.md/.test(c.descricao)))
    assert.ok(task.criterios.some(c => /1 fato\(s\) de memória existentes migrados/.test(c.descricao)))
    assert.ok(task.criterios.some(c => /buscar-skills/.test(c.descricao)))
  })

  it('leva o lock das skills de terceiros e o script que o confere', () => {
    const config = JSON.parse(readFileSync(resolve(TEMPLATE, 'harness.config.json'), 'utf8'))
    const doTemplate = JSON.parse(readFileSync(resolve(TEMPLATE, 'skills-lock.json'), 'utf8')).skills
    const naCamada = Object.keys(doTemplate).filter(nome => !config.layerExclude.includes(`.claude/skills/${nome}`))
    assert.deepEqual(Object.keys(JSON.parse(ler('skills-lock.json')).skills), naCamada)
    for (const nome of naCamada) assert.ok(existsSync(resolve(dest, '.claude/skills', nome, 'SKILL.md')), nome)
    assert.match(JSON.parse(ler('package.json')).scripts.skills, /skills\.mjs/)
  })

  // O vermelho que sobra é TRABALHO da adoção (marcadores e a memória antiga a migrar),
  // nunca um defeito da camada copiada.
  it('o repositório adotado só fica vermelho pelo que a adoção ainda tem de fazer', () => {
    git(dest, ['init', '-q'])
    const check = spawnSync(process.execPath, [resolve(dest, 'scripts/harness/check-claims.mjs')], { cwd: dest, encoding: 'utf8' })
    const erros = check.stderr.split('\n').filter(l => l.trim().startsWith('['))
    assert.ok(erros.length > 0, 'devia cobrar os marcadores pendentes')
    const esperado = l => l.includes('[pending-markers]') || /\[memory\] docs\/memory\/(fato-antigo\.md|MEMORY\.md)/.test(l)
    assert.deepEqual(erros.filter(l => !esperado(l)), [], `vermelho inesperado:\n${check.stderr}`)
    assert.ok(erros.some(l => l.includes('fato-antigo.md: status')), 'a memória antiga precisa ser cobrada')
  })

  // A suíte copiada contém este arquivo, mas lá `template: false` pula os testes de adoção.
  it('e a suíte do harness copiada passa no destino', () => {
    // NODE_TEST_CONTEXT faz o node:test filho achar que é recursão e pular TODOS os
    // arquivos com exit 0 — um verde vazio. A asserção de saída abaixo é o que pegou isso.
    const env = { ...process.env }
    delete env.NODE_TEST_CONTEXT
    const suite = spawnSync(process.execPath, ['--test', 'scripts/harness/test/*.test.mjs'], { cwd: dest, encoding: 'utf8', env })
    assert.match(suite.stdout, /^# pass [1-9]/m, `a suíte não rodou nada: ${suite.stderr?.slice(0, 300)}`)
    assert.match(suite.stdout, /^# fail 0/m, suite.stdout.split('\n').filter(l => /not ok|Error/.test(l)).join('\n'))
  })
})
