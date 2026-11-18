/**
 * Teto de memória (RAM) do processo inteiro, carregado com `node --import` em todo
 * `node --test` do harness. O `--max-old-space-size` só limita o heap do V8; o que cresce fora
 * dele (um assert que serializa um objeto gigante, uma sabotagem ou mutante que vira laço que
 * só acumula) travava a máquina. O worker mede a memória residente e encerra o processo acima
 * do limite — roda à parte, então age mesmo com a thread principal presa num laço síncrono.
 *
 * TETO_DE_MEMORIA_MB muda o limite (padrão 2048).
 */
import { Worker } from 'node:worker_threads'

export const LIMITE_PADRAO_MB = 2048
export const INTERVALO_MS = 200

export function limiteEmMb(valor) {
  return /^[1-9]\d*$/.test(valor ?? '') ? Number(valor) : LIMITE_PADRAO_MB
}

export const mensagemDoTeto = (limite, rss) =>
  `teto de memória: o processo ${process.pid} passou de ${limite} MB (memória residente ${rss} MB) e foi encerrado. Procure o laço que só acumula.\n`

const CODIGO = `
const { workerData } = require('node:worker_threads')
const { writeSync } = require('node:fs')
setInterval(() => {
  const rss = Math.round(process.memoryUsage.rss() / 1048576)
  if (rss > workerData.limite) {
    writeSync(2, workerData.mensagem.replace('{rss}', String(rss)))
    process.kill(process.pid, 'SIGKILL')
  }
}, workerData.intervalo)
`

const limite = limiteEmMb(process.env.TETO_DE_MEMORIA_MB)
new Worker(CODIGO, { eval: true, workerData: { limite, intervalo: INTERVALO_MS, mensagem: mensagemDoTeto(limite, '{rss}') } }).unref()
