/**
 * Os hooks executados como o Claude Code os executa: processo novo, evento JSON no stdin,
 * exit 2 = bloqueia. Todo bloqueio tem o caso vizinho que precisa PASSAR — guarda que
 * bloqueia texto legítimo é desligada, e aí não protege nada.
 */
import assert from 'node:assert/strict'
import { resolve } from 'node:path'
import { after, describe, it } from 'node:test'
import { cleanup, git, makeRepo, run, TERMO, write } from './fixture.mjs'

const repos = []
function repo({ commit = true, branch } = {}) {
  const root = makeRepo()
  repos.push(root)
  if (commit) {
    git(root, ['add', '-A'])
    git(root, ['commit', '-q', '-m', 'base'])
  }
  if (branch) git(root, ['switch', '-q', '-c', branch])
  return root
}
after(() => repos.forEach(cleanup))

const bash = (root, command) => run('.claude/hooks/bash-guard.mjs', { root, input: { tool_name: 'Bash', tool_input: { command }, cwd: root } })
const bloqueia = (root, command) => assert.equal(bash(root, command).code, 2, `deveria bloquear: ${command}`)
const passa = (root, command) => {
  const r = bash(root, command)
  assert.equal(r.code, 0, `deveria passar: ${command}\n${r.err}`)
}

describe('bash-guard: branch protegida', () => {
  it('bloqueia commit na main', () => bloqueia(repo(), 'git commit -m "x"'))
  it('passa commit numa branch de feature, mesmo com "main" na mensagem', () => {
    passa(repo({ branch: 'feat/x' }), 'git add -A && git commit -m "conserta o push to main"')
  })
  // A aspa de fechamento não pode colar no flag (`--force"`): na primeira versão colava, e o
  // teste passava mesmo sem descartar as aspas — visto ao mutar a guarda.
  it('o que está entre aspas é dado: separador e comando dentro da mensagem não contam', () => {
    passa(repo({ branch: 'feat/x' }), 'git commit -m "documenta: nunca faça a && git push --force origin x"')
    passa(repo({ branch: 'feat/x' }), "git commit -m 'documenta: nunca faça a; git reset --hard HEAD'")
  })
  it('passa o PRIMEIRO commit do repositório, na main', () => passa(repo({ commit: false }), 'git commit -m "inicial"'))
  it('bloqueia push direto para main, inclusive por refspec', () => {
    const root = repo({ branch: 'feat/x' })
    bloqueia(root, 'git push origin main')
    bloqueia(root, 'git push origin HEAD:main')
  })
  it('passa push da própria branch', () => passa(repo({ branch: 'feat/x' }), 'git push -u origin feat/x'))
})

describe('bash-guard: destrutivo', () => {
  const root = repo({ branch: 'feat/x' })
  it('bloqueia --force, mas passa --force-with-lease', () => {
    bloqueia(root, 'git push --force origin feat/x')
    bloqueia(root, 'git push -f')
    passa(root, 'git push --force-with-lease origin feat/x')
  })
  it('bloqueia --no-verify', () => bloqueia(root, 'git commit --no-verify -m x'))
  it('bloqueia reset --hard, mas passa reset --soft', () => {
    bloqueia(root, 'git reset --hard HEAD~1')
    passa(root, 'git reset --soft HEAD~1')
  })
  it('bloqueia clean -fd e checkout .', () => {
    bloqueia(root, 'git clean -fd')
    bloqueia(root, 'git checkout .')
    passa(root, 'git checkout -- src/a.ts')
  })
  it('bloqueia rm -rf fora dos diretórios gerados, mas passa neles', () => {
    bloqueia(root, 'rm -rf src')
    bloqueia(root, 'rm -rf node_modules src')
    passa(root, 'rm -rf node_modules dist/')
  })
  it('ignora o comando escrito dentro de heredoc', () => {
    passa(root, "cat > notas.md <<'EOF'\nnunca rode git reset --hard\nEOF")
  })
})

describe('bash-guard: segredo, migração remota, termo proibido', () => {
  const root = repo({ branch: 'feat/x' })
  it('bloqueia leitura de .env, mas passa .env.example e o setup cp', () => {
    bloqueia(root, 'cat .env')
    bloqueia(root, 'grep TOKEN config/.env.production')
    passa(root, 'cat .env.example')
    passa(root, 'cp .env.example .env')
  })
  it('bloqueia migração remota, passa a local', () => {
    bloqueia(root, 'node scripts/db/migrate.mjs up --remote')
    passa(root, 'node scripts/db/migrate.mjs up')
  })
  it('bloqueia termo proibido até dentro da mensagem de commit', () => {
    bloqueia(root, `git commit -m "integra com ${TERMO.toUpperCase()}"`)
  })
})

describe('file-guard', () => {
  const root = repo()
  const file = (tool_name, tool_input) => run('.claude/hooks/file-guard.mjs', { root, input: { tool_name, tool_input } })
  it('bloqueia ler .env e chave; passa .env.example', () => {
    assert.equal(file('Read', { file_path: `${root}/.env` }).code, 2)
    assert.equal(file('Read', { file_path: `${root}/certs/server.pem` }).code, 2)
    assert.equal(file('Read', { file_path: `${root}/.env.example` }).code, 0)
  })
  it('bloqueia escrever termo proibido; passa conteúdo normal', () => {
    assert.equal(file('Write', { file_path: `${root}/docs/a.md`, content: `cliente ${TERMO}` }).code, 2)
    assert.equal(file('Edit', { file_path: `${root}/docs/a.md`, old_string: 'a', new_string: TERMO }).code, 2)
    assert.equal(file('Write', { file_path: `${root}/docs/a.md`, content: 'texto comum' }).code, 0)
  })
  // O modo plano grava fora do repo, numa pasta cujo caminho pode conter o termo: o
  // bloqueio ali travava o planejamento sem proteger nada versionado.
  it('não acusa termo em arquivo fora do repositório; segredo continua bloqueado', () => {
    const fora = resolve(root, '..', `${TERMO}-config`, 'plans', 'plano.md')
    assert.equal(file('Write', { file_path: fora, content: `plano ${TERMO}` }).code, 0)
    assert.equal(file('Read', { file_path: resolve(root, '..', 'fora', '.env') }).code, 2)
  })
})

describe('fail-open', () => {
  // A primeira versão deste teste mandava stdin vazio — que nunca chega ao catch. Um hook
  // trocado para "fail-closed" passava verde. Provocar o erro interno de verdade é o
  // único jeito de testar o caminho de erro.
  it('erro interno (config ausente) avisa e deixa passar, sem bloquear', async () => {
    const { rmSync } = await import('node:fs')
    const root = repo()
    rmSync(`${root}/harness.config.json`)
    const r = bash(root, 'git commit -m x')
    assert.equal(r.code, 0)
    assert.match(r.err, /erro interno, deixando passar/)
  })
})

describe('session-start', () => {
  it('imprime branch, tarefas abertas, suspeitos e o índice da memória', () => {
    const root = repo()
    write(root, 'work/2026-01-01-x/task.json', JSON.stringify({ objetivo: 'objetivo de teste', criterios: [{ descricao: 'd', passa: false }] }))
    write(root, 'work/2026-01-01-x/PROGRESS.md', '### 2026-01-01 — começou\n- próximo passo: continuar\n')
    const { code, out } = run('.claude/hooks/session-start.mjs', { root, input: { hook_event_name: 'SessionStart', source: 'startup' } })
    assert.equal(code, 0)
    assert.match(out, /branch: main/)
    assert.match(out, /objetivo de teste · 1 critério\(s\) pendente\(s\) · último registro: - próximo passo: continuar/)
    assert.match(out, /SUSPEITOS[\s\S]*fato-ok/)
    assert.match(out, /# Memória do projeto — índice/)
  })
})

describe('stop-check', () => {
  it('silencioso e exit 0 com o repositório consistente', () => {
    const r = run('.claude/hooks/stop-check.mjs', { root: repo(), input: { stop_hook_active: false } })
    assert.equal(r.code, 0)
    assert.equal(r.err, '')
  })
  it('exit 2 com só os erros quando o repositório mente', () => {
    const root = repo()
    write(root, 'docs/x.md', 'veja `src/sumiu.ts`')
    const r = run('.claude/hooks/stop-check.mjs', { root, input: { stop_hook_active: false } })
    assert.equal(r.code, 2)
    assert.match(r.err, /\[cited-path\].*src\/sumiu\.ts/)
  })
  it('não prende o agente em laço: com stop_hook_active, deixa parar', () => {
    const root = repo()
    write(root, 'docs/x.md', 'veja `src/sumiu.ts`')
    assert.equal(run('.claude/hooks/stop-check.mjs', { root, input: { stop_hook_active: true } }).code, 0)
  })
})

describe('usage-log', () => {
  it('registra a skill chamada em .harness/usage.jsonl', async () => {
    const root = repo()
    run('.claude/hooks/usage-log.mjs', { root, input: { hook_event_name: 'PostToolUse', tool_name: 'Skill', tool_input: { skill: 'memoria' } } })
    const { readFileSync } = await import('node:fs')
    const linha = JSON.parse(readFileSync(`${root}/.harness/usage.jsonl`, 'utf8').trim())
    assert.deepEqual(linha.skill, { skill: 'memoria' })
  })
})
