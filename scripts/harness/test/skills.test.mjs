/**
 * Skills de terceiros: instaladas de um repositório git de verdade (local, sem rede),
 * fixadas por SHA e hash. Cada recusa tem o caso vizinho que precisa passar.
 */
import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { after, describe, it } from 'node:test'
import { runChecks } from '../check-claims.mjs'
import { add, hashDir, list, readLock, remove, verifyLock } from '../skills.mjs'
import { cleanup, git, makeRepo, run, TERMO, write } from './fixture.mjs'

const dirs = []
after(() => dirs.forEach(cleanup))

const DESC = 'Uma skill de terceiro com descrição longa o bastante para disparar.'

/** Repositório "upstream" com uma skill que cita os PRÓPRIOS caminhos, como as reais fazem. */
function upstream(arquivos = {}) {
  const dir = mkdtempSync(resolve(tmpdir(), 'harness-upstream-'))
  dirs.push(dir)
  const base = {
    'skills/boa/SKILL.md': `---\nname: boa\ndescription: ${DESC}\nlicense: MIT\n---\n\nRode \`scripts/helper.py\` e \`pnpm gerar:tudo\`. Veja [ref](reference.md).\n`,
    'skills/boa/scripts/helper.py': 'print("oi")\r\n',
    'skills/boa/reference.md': 'referência\n',
    ...arquivos,
  }
  for (const [path, content] of Object.entries(base)) write(dir, path, content)
  git(dir, ['init', '-q', '-b', 'main'])
  git(dir, ['config', 'user.email', 'up@example.com'])
  git(dir, ['config', 'user.name', 'up'])
  git(dir, ['add', '-A'])
  git(dir, ['commit', '-q', '-m', 'skills'])
  return { dir, sha: git(dir, ['rev-parse', 'HEAD']).trim() }
}

function repo() {
  const root = makeRepo()
  dirs.push(root)
  return root
}

describe('skills add', () => {
  const up = upstream()
  const root = repo()
  const r = add(root, { repo: up.dir, path: 'skills/boa', ref: up.sha })

  it('copia para .claude/skills/<name> e grava o lock com SHA e hash', () => {
    assert.ok(existsSync(resolve(root, '.claude/skills/boa/scripts/helper.py')))
    const entrada = readLock(root).skills.boa
    assert.equal(entrada.ref, up.sha)
    assert.equal(entrada.sha256, hashDir(resolve(root, '.claude/skills/boa')))
    assert.equal(entrada.license, 'MIT')
    assert.equal(entrada.trusted, false)
    assert.equal(r.arquivos, 3)
  })

  it('não deixa o clone temporário para trás', () => {
    const tmp = resolve(root, 'tmp')
    assert.deepEqual(existsSync(tmp) ? readdirSync(tmp) : [], [])
  })

  it('o repositório continua verde: a prosa de upstream não é cobrada como nossa', () => {
    assert.deepEqual(runChecks(root), [])
  })

  it('lista a origem de cada skill', () => {
    assert.deepEqual(list(root).map(s => s.nome), ['boa', 'ok'])
    assert.equal(list(root).find(s => s.nome === 'ok').origem, 'projeto')
  })
})

describe('skills add recusa', () => {
  it('ref que não é SHA (branch muda depois da revisão)', () => {
    const up = upstream()
    assert.throws(() => add(repo(), { repo: up.dir, path: 'skills/boa', ref: 'main' }), /SHA de 40/)
  })
  it('sobrescrever skill do projeto', () => {
    const up = upstream({ 'skills/ok/SKILL.md': `---\nname: ok\ndescription: ${DESC}\n---\n` })
    assert.throws(() => add(repo(), { repo: up.dir, path: 'skills/ok', ref: up.sha }), /é do projeto/)
  })
  it('termo proibido no conteúdo', () => {
    const up = upstream({ 'skills/boa/reference.md': `fale com ${TERMO}\n` })
    const root = repo()
    assert.throws(() => add(root, { repo: up.dir, path: 'skills/boa', ref: up.sha }), /termo proibido.*reference\.md/)
    assert.ok(!existsSync(resolve(root, '.claude/skills/boa')))
  })
  it('skill sem description', () => {
    const up = upstream({ 'skills/boa/SKILL.md': '---\nname: boa\n---\n' })
    assert.throws(() => add(repo(), { repo: up.dir, path: 'skills/boa', ref: up.sha }), /description/)
  })
})

describe('third-party-skills (verify)', () => {
  function instalada() {
    const up = upstream()
    const root = repo()
    add(root, { repo: up.dir, path: 'skills/boa', ref: up.sha })
    return root
  }
  it('pega skill travada editada à mão', () => {
    const root = instalada()
    write(root, '.claude/skills/boa/reference.md', 'editado\n')
    assert.match(verifyLock(root)[0], /difere do que foi aprovado/)
    assert.match(runChecks(root, { only: 'third-party-skills' })[0].erro, /boa/)
  })
  it('pega entrada do lock sem pasta', () => {
    const root = instalada()
    cleanup(resolve(root, '.claude/skills/boa'))
    assert.match(verifyLock(root)[0], /não existe/)
  })
  it('aceita a mesma skill com fim de linha CRLF (checkout Windows)', () => {
    const root = instalada()
    write(root, '.claude/skills/boa/reference.md', 'referência\r\n')
    assert.deepEqual(verifyLock(root), [])
  })
  it('termo proibido continua cobrado dentro da pasta travada', () => {
    const root = instalada()
    write(root, '.claude/skills/boa/reference.md', `${TERMO}\n`)
    assert.ok(runChecks(root, { only: 'forbidden-terms' }).length)
  })
  it('remove apaga pasta e entrada; skill do projeto não se remove por aqui', () => {
    const root = instalada()
    remove(root, 'boa')
    assert.ok(!existsSync(resolve(root, '.claude/skills/boa')))
    assert.deepEqual(readLock(root).skills, {})
    assert.throws(() => remove(root, 'ok'), /não está/)
  })
})

describe('skills.mjs CLI', () => {
  it('verify sai 1 com skill adulterada e 0 sem lock', () => {
    const up = upstream()
    const root = repo()
    assert.equal(run('scripts/harness/skills.mjs', { root, args: ['verify'] }).code, 0)
    assert.equal(run('scripts/harness/skills.mjs', { root, args: ['add', up.dir, 'skills/boa', '--ref', up.sha] }).code, 0)
    write(root, '.claude/skills/boa/SKILL.md', 'mexido\n')
    const r = run('scripts/harness/skills.mjs', { root, args: ['verify'] })
    assert.equal(r.code, 1)
    assert.match(r.err, /difere/)
  })
})
