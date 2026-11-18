/**
 * Lê uma linha de shell (bash ou PowerShell) e devolve os comandos que ela roda, cada um com
 * o programa, as palavras já sem aspas e os redirecionamentos.
 *
 * Decisões que não devem ser desfeitas (cada uma tem teste em scripts/harness/test/rules.test.mjs):
 * - texto entre aspas e corpo de heredoc são DADO: `git commit -m "nunca git push -f"` roda
 *   um commit, não um push. Guarda que grita em texto legítimo é desligada na primeira semana.
 * - o que roda por dentro conta como comando: `$(…)`, crase, `bash -c "…"`, `sh -c`,
 *   `pwsh -Command "…"` e `cmd /c`. É o caminho óbvio para esconder um comando do guarda —
 *   e era o ponto cego do bash-guard antigo, que tratava a aspa do `bash -c` como dado.
 * - palavra com `$`, crase ou `~` no começo é marcada `dynamic`: o valor só existe na hora de
 *   rodar, e a regra que precisa do valor (um caminho) trata como desconhecido.
 */

const BASH_WRAPPERS = new Set(['sudo', 'env', 'command', 'builtin', 'exec', 'nohup', 'time', 'nice', 'xargs', 'doas'])
const SHELLS_BASH = new Set(['bash', 'sh', 'zsh', 'dash', 'ksh'])
const SHELLS_POWERSHELL = new Set(['pwsh', 'powershell'])

/** @typedef {{ value: string, quoted: boolean, dynamic: boolean, glob: boolean }} Word */
/** @typedef {{ op: string, target: Word }} Redirect */
/** @typedef {{ program: string, words: Word[], args: Word[], env: Record<string,string>, redirects: Redirect[], fromStdin: boolean, shell: string }} Command */

/** Nome do programa sem pasta, sem `.exe` e em minúsculas: `/usr/bin/git`, `git.exe` e `Git` são `git`. */
export function programName(word) {
  return (word ?? '').split(/[\\/]/).pop().replace(/\.(exe|cmd|bat)$/i, '').toLowerCase()
}

function tokenize(src, shell) {
  const commands = []
  const nested = []
  const escape = shell === 'powershell' ? '`' : '\\'
  let cmd = { words: [], redirects: [] }
  let word = null
  let pendingRedirect = null
  const heredocs = []

  const startWord = () => {
    word ??= { value: '', quoted: false, dynamic: false, glob: false }
  }
  const endWord = () => {
    if (!word) return
    if (pendingRedirect) {
      if (pendingRedirect === '<<' || pendingRedirect === '<<-') heredocs.push({ delimiter: word.value, tabs: pendingRedirect === '<<-' })
      else if (pendingRedirect !== '<<<') cmd.redirects.push({ op: pendingRedirect, target: word })
      pendingRedirect = null
    } else {
      cmd.words.push(word)
    }
    word = null
  }
  const endCommand = () => {
    endWord()
    if (cmd.words.length || cmd.redirects.length) commands.push(cmd)
    cmd = { words: [], redirects: [] }
  }
  /** Do índice depois de `$(` até o `)` que fecha, respeitando aspas e parênteses aninhados. */
  const balanced = start => {
    let depth = 1
    let quote = null
    for (let j = start; j < src.length; j++) {
      const c = src[j]
      if (quote) {
        if (c === quote) quote = null
        else if (c === escape && quote === '"') j++
      } else if (c === "'" || c === '"') quote = c
      else if (c === '(') depth++
      else if (c === ')' && --depth === 0) return [src.slice(start, j), j]
    }
    return [src.slice(start), src.length]
  }
  const skipHeredocBodies = from => {
    let i = from
    while (heredocs.length) {
      const { delimiter, tabs } = heredocs.shift()
      while (i < src.length) {
        const nl = src.indexOf('\n', i)
        const line = src.slice(i, nl === -1 ? src.length : nl).replace(/\r$/, '')
        i = nl === -1 ? src.length : nl + 1
        if ((tabs ? line.replace(/^\t+/, '') : line) === delimiter) break
      }
    }
    return i
  }

  let i = 0
  while (i < src.length) {
    const c = src[i]
    if (c === '\n') {
      endCommand()
      i = skipHeredocBodies(i + 1)
      continue
    }
    if (c === '\r') {
      i++
      continue
    }
    if (c === ' ' || c === '\t') {
      endWord()
      i++
      continue
    }
    if (c === '#' && !word) {
      const nl = src.indexOf('\n', i)
      i = nl === -1 ? src.length : nl
      continue
    }
    if (shell === 'powershell' && !word && c === '@' && (src[i + 1] === "'" || src[i + 1] === '"') && /^\r?\n/.test(src.slice(i + 2, i + 4))) {
      const close = src.indexOf(`\n${src[i + 1]}@`, i + 2)
      startWord()
      word.quoted = true
      i = close === -1 ? src.length : close + 3
      continue
    }
    if (c === escape) {
      if (src[i + 1] !== '\n') {
        startWord()
        word.value += src[i + 1] ?? ''
      }
      i += 2
      continue
    }
    if (c === "'") {
      startWord()
      word.quoted = true
      let j = i + 1
      if (shell === 'powershell') {
        while (j < src.length && !(src[j] === "'" && src[j + 1] !== "'")) {
          word.value += src[j]
          j += src[j] === "'" ? 2 : 1
        }
      } else {
        const end = src.indexOf("'", j)
        const stop = end === -1 ? src.length : end
        word.value += src.slice(j, stop)
        j = stop
      }
      i = j + 1
      continue
    }
    if (c === '"') {
      startWord()
      word.quoted = true
      let j = i + 1
      while (j < src.length && src[j] !== '"') {
        const d = src[j]
        if (d === escape) {
          word.value += src[j + 1] ?? ''
          j += 2
        } else if (d === '$' && src[j + 1] === '(') {
          const [inner, end] = balanced(j + 2)
          nested.push(inner)
          word.dynamic = true
          word.value += src.slice(j, end + 1)
          j = end + 1
        } else if (d === '`' && shell === 'bash') {
          const end = src.indexOf('`', j + 1)
          const stop = end === -1 ? src.length : end
          nested.push(src.slice(j + 1, stop))
          word.dynamic = true
          word.value += src.slice(j, stop + 1)
          j = stop + 1
        } else {
          if (d === '$') word.dynamic = true
          word.value += d
          j++
        }
      }
      i = j + 1
      continue
    }
    if (c === '$' && src[i + 1] === '(') {
      startWord()
      const [inner, end] = balanced(i + 2)
      nested.push(inner)
      word.dynamic = true
      word.value += src.slice(i, end + 1)
      i = end + 1
      continue
    }
    if (c === '`' && shell === 'bash') {
      startWord()
      const end = src.indexOf('`', i + 1)
      const stop = end === -1 ? src.length : end
      nested.push(src.slice(i + 1, stop))
      word.dynamic = true
      word.value += src.slice(i, stop + 1)
      i = stop + 1
      continue
    }
    if (c === ';' || c === '(' || c === ')') {
      endCommand()
      i++
      continue
    }
    if (c === '|') {
      endCommand()
      i += src[i + 1] === '|' || src[i + 1] === '&' ? 2 : 1
      continue
    }
    if (c === '&') {
      if (src[i + 1] === '&') {
        endCommand()
        i += 2
      } else if (src[i + 1] === '>') {
        endWord()
        pendingRedirect = src[i + 2] === '>' ? '>>' : '>'
        i += src[i + 2] === '>' ? 3 : 2
      } else if (shell === 'bash') {
        endCommand()
        i++
      } else {
        // `&` no PowerShell é o operador de chamada: `& git push -f` roda o git.
        endWord()
        i++
      }
      continue
    }
    if (c === '>' || c === '<') {
      if (word && !word.quoted && /^\d+$/.test(word.value)) word = null
      else endWord()
      let op = c
      let j = i + 1
      while (src[j] === '>' || src[j] === '<') op += src[j++]
      if (src[j] === '&') {
        const dup = /^&(\d+|-)/.exec(src.slice(j))
        if (dup) {
          i = j + dup[0].length
          continue
        }
        j++
      }
      if (op === '<<' && src[j] === '-') {
        op = '<<-'
        j++
      }
      pendingRedirect = op
      i = j
      continue
    }
    startWord()
    if (c === '*' || c === '?' || c === '[') word.glob = true
    if (c === '~' && word.value === '') word.dynamic = true
    if (c === '$') word.dynamic = true
    word.value += c
    i++
  }
  endCommand()
  return { commands, nested }
}

function unwrap(raw, shell) {
  let words = raw.words
  const env = {}
  let fromStdin = false
  for (;;) {
    const first = words[0]
    if (!first) return []
    const assignment = shell === 'bash' && /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/s.exec(first.value)
    if (assignment) {
      env[assignment[1]] = assignment[2]
      words = words.slice(1)
      continue
    }
    const name = programName(first.value)
    if (BASH_WRAPPERS.has(name)) {
      if (name === 'xargs') fromStdin = true
      words = words.slice(1)
      // opções do próprio wrapper (`sudo -u x`, `env -i`, `nice -n 5`) não são o programa
      while (words[0] && (words[0].value.startsWith('-') || (name === 'env' && /^[A-Za-z_]\w*=/.test(words[0].value)))) {
        const flag = words[0].value
        const m = /^([A-Za-z_]\w*)=(.*)$/s.exec(flag)
        if (m) env[m[1]] = m[2]
        words = words.slice(['-u', '-g', '-n', '-I', '-L', '-P'].includes(flag) ? 2 : 1)
      }
      continue
    }
    // Wrappers com argumento posicional antes do programa (revisão fria: `timeout 60 git push
    // --force` e `stdbuf -o0 git reset --hard` passavam).
    if (name === 'timeout' || name === 'stdbuf' || name === 'ionice' || name === 'chrt' || name === 'taskset' || name === 'setsid' || name === 'unbuffer') {
      words = words.slice(1)
      while (words[0]?.value.startsWith('-')) words = words.slice(['-s', '-k', '--signal', '--kill-after', '-c', '-n', '-p'].includes(words[0].value) ? 2 : 1)
      if (['timeout', 'chrt', 'taskset'].includes(name) && words[0] && !words[0].value.startsWith('-')) words = words.slice(1)
      continue
    }
    break
  }
  const program = programName(words[0].value)
  const args = words.slice(1)
  // `eval "…"` roda o texto como comando.
  if (program === 'eval') return parseShell(args.map(w => w.value).join(' '), shell)
  // `find … -exec cmd {} +` roda cmd para cada arquivo.
  if (program === 'find') {
    const execs = []
    for (let i = 0; i < args.length; i++) {
      if (!/^-(?:exec|execdir|ok|okdir)$/.test(args[i].value)) continue
      const fim = args.findIndex((w, j) => j > i && (w.value === ';' || w.value === '+'))
      execs.push(args.slice(i + 1, fim === -1 ? args.length : fim).map(w => w.value).join(' '))
    }
    if (execs.length) return [{ program, words, args, env, redirects: raw.redirects, fromStdin, shell }, ...execs.flatMap(e => parseShell(e, 'bash'))]
  }
  if (SHELLS_BASH.has(program)) {
    const at = args.findIndex(w => /^-[a-z]*c[a-z]*$/.test(w.value))
    if (at > -1 && args[at + 1]) return parseShell(args[at + 1].value, 'bash')
  }
  if (SHELLS_POWERSHELL.has(program)) {
    const at = args.findIndex(w => /^-(c|command)$/i.test(w.value))
    if (at > -1) return parseShell(args.slice(at + 1).map(w => w.value).join(' '), 'powershell')
  }
  if (program === 'cmd') {
    const at = args.findIndex(w => /^\/[ck]$/i.test(w.value))
    if (at > -1) return parseShell(args.slice(at + 1).map(w => w.value).join(' '), 'powershell')
  }
  return [{ program, words, args, env, redirects: raw.redirects, fromStdin, shell }]
}

/** @returns {Command[]} os comandos da linha, na ordem; os de dentro de `$(…)` vêm antes. */
export function parseShell(command, shell = 'bash') {
  const { commands, nested } = tokenize(command ?? '', shell)
  return [
    ...nested.flatMap(inner => parseShell(inner, shell)),
    ...commands.flatMap(raw => unwrap(raw, shell)),
  ]
}

const GIT_GLOBAL_WITH_VALUE = new Set(['-C', '-c', '--git-dir', '--work-tree', '--namespace', '--exec-path', '--config-env'])

/**
 * Lê uma chamada ao git: o subcomando, os argumentos dele e as opções globais (`-c k=v`).
 * @returns {{ sub: string, args: string[], configs: string[] } | null}
 */
export function gitInvocation(command) {
  if (command.program !== 'git') return null
  const rest = command.args.map(w => w.value)
  const configs = []
  while (rest[0]?.startsWith('-')) {
    const flag = rest.shift()
    if (flag === '-c') configs.push(rest.shift() ?? '')
    else if (GIT_GLOBAL_WITH_VALUE.has(flag)) rest.shift()
  }
  return { sub: rest[0] ?? '', args: rest.slice(1), configs }
}
