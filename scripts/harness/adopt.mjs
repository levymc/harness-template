/**
 * Leva a camada de harness deste template para um repositório EXISTENTE.
 *
 * Regra que não se negocia: NUNCA sobrescrever. Projeto antigo tem CLAUDE.md, settings e
 * skills que alguém escreveu por um motivo; quando um arquivo já existe com conteúdo
 * diferente, o nosso vai para `<arquivo>.harness-proposto` e o conflito entra no relatório
 * — quem resolve é o usuário, com a skill `adotar-harness`.
 *
 * O que é copiado está em `harness.config.json` → `layer` (menos `layerExclude`). O que é
 * GERADO em vez de copiado, porque o original é específico deste template:
 *   - AGENTS.md e a skill pre-push: moldes com marcadores `pendente`, que a regra
 *     `pending-markers` cobra até serem preenchidos com o usuário;
 *   - harness.config.json: sem forbiddenTerms (são do dono do template, não do projeto)
 *     e com as regras do esqueleto desligadas;
 *   - docs/guardrails.md: só as linhas cujo sensor existe no destino;
 *   - docs/decisions/README.md e docs/memory/MEMORY.md: vazios.
 *
 * Uso: node scripts/harness/adopt.mjs <destino> [--dry-run]
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync, appendFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { isMain, loadConfig, rel, ROOT, today, walk } from './lib.mjs'
import { renderIndex } from './memory.mjs'
import { RULES } from './check-claims.mjs'

const REGRAS_DO_ESQUELETO = ['no-sync', 'env-example']

export function planAdoption(dest, config = loadConfig(ROOT)) {
  const excluido = path => (config.layerExclude ?? []).some(ex => path === ex || path.startsWith(`${ex}/`))
  const arquivos = new Map() // caminho relativo → conteúdo (string) ou caminho de origem
  for (const entrada of config.layer) {
    for (const file of walk(resolve(ROOT, entrada))) {
      const caminho = rel(ROOT, file)
      if (!excluido(caminho)) arquivos.set(caminho, { origem: file })
    }
  }

  const ler = path => readFileSync(resolve(ROOT, path), 'utf8')
  arquivos.set('AGENTS.md', { conteudo: ler('scripts/harness/templates/AGENTS.md') })
  arquivos.set('.claude/skills/pre-push/SKILL.md', { conteudo: ler('scripts/harness/templates/pre-push.SKILL.md') })

  const novaConfig = structuredClone(config)
  novaConfig.template = false // adotar a partir de um repositório adotado não faz sentido
  novaConfig.forbiddenTerms = []
  novaConfig.checks = { disabled: [...new Set([...(config.checks?.disabled ?? []), ...REGRAS_DO_ESQUELETO])] }
  novaConfig.env = { example: '.env.example', sources: [], declarations: [] }
  arquivos.set('harness.config.json', { conteudo: `${JSON.stringify(novaConfig, null, 2)}\n` })

  arquivos.set('docs/memory/MEMORY.md', { conteudo: renderIndex([]) })

  const decisoes = ler('docs/decisions/README.md')
  arquivos.set('docs/decisions/README.md', {
    conteudo: `${decisoes.slice(0, decisoes.indexOf('| # |')).trimEnd()}\n\n| # | Decisão | Status |\n|---|---|---|\n`,
  })

  // guardrails: mantém a linha só se todo sensor dela vai existir no destino
  const vaiExistir = path => arquivos.has(path) || existsSync(resolve(dest, path))
  const ativas = new Set(RULES.map(r => r.id).filter(id => !novaConfig.checks.disabled.includes(id)))
  const linhas = ler('docs/guardrails.md').split('\n').filter(linha => {
    if (!/^\|/.test(linha) || /^\|\s*-/.test(linha) || /^\|\s*Nunca\s*\|/i.test(linha)) return true
    const sensor = linha.split('|')[3] ?? ''
    return [...sensor.matchAll(/`([^`]+)`/g)].map(m => m[1]).every(ref => {
      const [alvo, id] = ref.split(':')
      return alvo === 'check-claims' ? ativas.has(id) : vaiExistir(alvo)
    })
  })
  arquivos.set('docs/guardrails.md', {
    conteudo: `${linhas.join('\n').trimEnd()}\n\n<!-- pendente: as proibições do próprio projeto, confirmadas com o usuário, cada uma com sensor ou "revisão" -->\n`,
  })

  const plano = []
  for (const [caminho, fonte] of [...arquivos].sort()) {
    const conteudo = fonte.conteudo ?? readFileSync(fonte.origem)
    const alvo = resolve(dest, caminho)
    if (!existsSync(alvo)) plano.push({ caminho, acao: 'criar', conteudo })
    else if (Buffer.compare(readFileSync(alvo), Buffer.from(conteudo)) === 0) plano.push({ caminho, acao: 'igual' })
    else plano.push({ caminho, acao: 'conflito', conteudo })
  }
  return plano
}

function scriptsParaPackageJson(dest) {
  const file = resolve(dest, 'package.json')
  if (!existsSync(file)) return { file: null, novos: [] }
  const pkg = JSON.parse(readFileSync(file, 'utf8'))
  const desejados = {
    'harness:check': 'node scripts/harness/check-claims.mjs',
    'harness:test': 'node --test "scripts/harness/test/*.test.mjs"',
    memory: 'node scripts/harness/memory.mjs',
    skills: 'node scripts/harness/skills.mjs',
  }
  const novos = Object.keys(desejados).filter(k => !pkg.scripts?.[k])
  return { file, pkg, desejados, novos }
}

export function adopt(dest, { dryRun = false } = {}) {
  if (!existsSync(dest) || !statSync(dest).isDirectory()) throw new Error(`destino ${dest} não é um diretório`)
  if (resolve(dest) === ROOT) throw new Error('destino é o próprio template')
  if (loadConfig(ROOT).template !== true) throw new Error('este repositório não é o harness-template; adote a partir de uma cópia do template')
  const plano = planAdoption(dest)
  const pkg = scriptsParaPackageJson(dest)
  const relatorio = []

  for (const passo of plano) {
    if (passo.acao === 'igual') continue
    const alvo = resolve(dest, passo.acao === 'conflito' ? `${passo.caminho}.harness-proposto` : passo.caminho)
    relatorio.push(passo.acao === 'conflito'
      ? `CONFLITO  ${passo.caminho} já existe → proposta em ${passo.caminho}.harness-proposto`
      : `criado    ${passo.caminho}`)
    if (dryRun) continue
    mkdirSync(dirname(alvo), { recursive: true })
    writeFileSync(alvo, passo.conteudo)
  }

  if (pkg.novos.length) {
    relatorio.push(`package.json: scripts acrescentados → ${pkg.novos.join(', ')}`)
    if (!dryRun) {
      pkg.pkg.scripts = { ...pkg.pkg.scripts, ...Object.fromEntries(pkg.novos.map(k => [k, pkg.desejados[k]])) }
      writeFileSync(pkg.file, `${JSON.stringify(pkg.pkg, null, 2)}\n`)
    }
  }

  const gitignore = resolve(dest, '.gitignore')
  const atual = existsSync(gitignore) ? readFileSync(gitignore, 'utf8') : ''
  const faltam = ['.harness/', '.claude/settings.local.json'].filter(l => !atual.split(/\r?\n/).includes(l))
  if (faltam.length) {
    relatorio.push(`.gitignore: acrescentado ${faltam.join(', ')}`)
    if (!dryRun) appendFileSync(gitignore, `${atual && !atual.endsWith('\n') ? '\n' : ''}# harness\n${faltam.join('\n')}\n`)
  }

  const conflitos = plano.filter(p => p.acao === 'conflito').map(p => p.caminho)
  const memoriasExistentes = existsSync(resolve(dest, 'docs/memory'))
    ? walk(resolve(dest, 'docs/memory'), f => f.endsWith('.md') && !/(MEMORY|README)\.md$/.test(f)).length
    : 0
  if (memoriasExistentes) relatorio.push(`docs/memory: ${memoriasExistentes} fato(s) já existentes — migre para o formato (status, verified, citations) com a skill memoria`)
  const tarefa = `work/${today()}-adotar-harness`
  if (!dryRun) {
    mkdirSync(resolve(dest, tarefa), { recursive: true })
    writeFileSync(resolve(dest, tarefa, 'task.json'), `${JSON.stringify({
      objetivo: 'Adotar o harness neste repositório, com AGENTS.md e guardrails escritos com o usuário',
      contexto: 'Camada instalada por scripts/harness/adopt.mjs. Siga a skill adotar-harness.',
      criterios: [
        { descricao: 'AGENTS.md sem marcadores pendentes, com comandos que foram rodados e funcionaram', passa: false },
        { descricao: 'docs/guardrails.md com as proibições do projeto, cada uma com sensor ou "revisão"', passa: false },
        { descricao: 'skill pre-push espelhando o CI real do projeto', passa: false },
        { descricao: '3 a 5 fatos de memória com citação', passa: false },
        { descricao: 'skills de terceiros para a stack do projeto revisadas com a skill buscar-skills: instaladas (skills-lock.json) ou recusadas com motivo no PROGRESS', passa: false },
        ...conflitos.map(c => ({ descricao: `conflito resolvido com o usuário: ${c}`, passa: false })),
        ...(memoriasExistentes ? [{ descricao: `${memoriasExistentes} fato(s) de memória existentes migrados (status, verified, citations) ou marcados superseded`, passa: false }] : []),
        { descricao: 'node scripts/harness/check-claims.mjs verde', passa: false },
      ],
      fora_de_escopo: ['mudar código do produto'],
    }, null, 2)}\n`)
    writeFileSync(resolve(dest, tarefa, 'PROGRESS.md'), `### ${today()} — camada do harness instalada por adopt.mjs\n${relatorio.map(l => `- ${l}`).join('\n')}\n- próximo passo: skill adotar-harness, etapa 2 (arqueologia)\n`)
  }
  relatorio.push(dryRun ? '(dry-run: nada foi escrito)' : `tarefa aberta: ${tarefa}`)
  return { relatorio, conflitos }
}

if (isMain(import.meta)) {
  const args = process.argv.slice(2)
  const dest = args.find(a => !a.startsWith('--'))
  if (!dest) {
    console.error('uso: node scripts/harness/adopt.mjs <destino> [--dry-run]')
    process.exit(1)
  }
  try {
    const { relatorio, conflitos } = adopt(resolve(dest), { dryRun: args.includes('--dry-run') })
    console.log(relatorio.join('\n'))
    if (conflitos.length) console.log(`\n${conflitos.length} conflito(s): nada foi sobrescrito. Resolva com o usuário e apague os .harness-proposto.`)
    console.log('\nPróximo passo: no destino, siga a skill adotar-harness (.claude/skills/adotar-harness/SKILL.md).')
  } catch (error) {
    console.error(`✗ ${error.message}`)
    process.exit(1)
  }
}
