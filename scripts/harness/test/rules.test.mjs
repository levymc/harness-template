/**
 * O parser de shell e o motor, nas decisões que as provas das regras não mostram sozinhas.
 * O comportamento de cada regra está na `proof` dela (rodada pela `rule-proofs`); aqui fica o
 * que é do motor: aspas são dado, comando aninhado conta, contrato incompleto não entra.
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { CATALOG } from '../rules/catalog.mjs'
import { evaluateAction, hookMessages, modeOf, PROOF_CONFIG, ruleContractProblems } from '../rules/engine.mjs'
import { gitInvocation, parseShell } from '../rules/shell.mjs'

const programas = (cmd, shell) => parseShell(cmd, shell).map(c => c.program)

describe('parseShell', () => {
  it('separa por ;, &&, || e |', () => {
    assert.deepEqual(programas('a; b && c || d | e'), ['a', 'b', 'c', 'd', 'e'])
  })
  it('texto entre aspas é dado, não comando', () => {
    assert.deepEqual(programas('git commit -m "a && git push --force"'), ['git'])
  })
  it('corpo de heredoc é dado', () => {
    assert.deepEqual(programas("cat > x.md <<'EOF'\ngit reset --hard\nEOF\necho fim"), ['cat', 'echo'])
  })
  it('desembrulha bash -c, sh -c, $(…), crase, sudo, env e cmd /c', () => {
    assert.deepEqual(programas('bash -c "git status"'), ['git'])
    assert.deepEqual(programas("sudo env A=1 sh -c 'rm x'"), ['rm'])
    assert.deepEqual(programas('echo $(git log) `whoami`'), ['git', 'whoami', 'echo'])
    assert.deepEqual(programas('cmd /c git push', 'powershell'), ['git'])
  })
  it('marca palavra dinâmica e glob', () => {
    const [cmd] = parseShell('rm -rf $DIR *.log ~/x')
    assert.deepEqual(cmd.args.slice(1).map(w => [w.dynamic, w.glob]), [[true, false], [false, true], [true, false]])
  })
  it('gitInvocation pula opções globais', () => {
    const [cmd] = parseShell('git -C ../x -c a=b push -f')
    assert.deepEqual(gitInvocation(cmd), { sub: 'push', args: ['-f'], configs: ['a=b'] })
  })
})

describe('motor', () => {
  it('todo o catálogo cumpre o contrato', () => {
    assert.deepEqual(CATALOG.flatMap(ruleContractProblems), [])
  })
  it('o modo vem da config e cai no padrão; off desliga', () => {
    const regra = CATALOG.find(r => r.id === 'commit-message-format')
    assert.equal(modeOf(regra, {}), 'warn')
    assert.equal(modeOf(regra, { rules: { 'commit-message-format': { mode: 'block' } } }), 'block')
    const action = { kind: 'shell', shell: 'bash', branch: 'feat/x', hasCommits: true, command: 'git commit -m "zzz"' }
    assert.equal(evaluateAction(action, CATALOG, { ...PROOF_CONFIG, rules: { 'commit-message-format': { mode: 'off' } } }).warn.length, 0)
  })
  it('junta todos os bloqueios numa mensagem, com o id e a âncora', () => {
    const action = { kind: 'shell', shell: 'bash', branch: 'feat/x', hasCommits: true, command: 'git reset --hard && git push -f' }
    const { block, warn } = hookMessages(evaluateAction(action, CATALOG, PROOF_CONFIG))
    assert.match(block, /\[no-force-push\][\s\S]*\[no-discard-work\]|\[no-discard-work\][\s\S]*\[no-force-push\]/)
    assert.equal(warn, undefined)
  })
})
