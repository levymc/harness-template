---
status: accepted
date: 2026-11-18
supersedes:
superseded_by:
---

# 0007 — O loop de melhoria do harness, e a barra que ele não mexe

## Contexto

O template tinha a escada "lição vira guarda" (skill `licao`), mas nenhum canal para o atrito
chegar, nenhuma exigência de prova para aceitar uma correção, e nada que impedisse o próprio
loop de afrouxar o harness. Um harness de referência, usado por outro time, mostrou o ciclo
completo: atrito relatado com o trecho literal da sessão, triagem que só aceita defeito com
teste vermelho, prova antes do "pronto" (gate inteiro, parada na segunda falha igual, revisão
em contexto frio, mutação nas linhas novas) e **a barra**.

O risco que a barra resolve: o agente que conserta o próprio harness pode afrouxar a régua que
o reprovou — tirar um passo do gate, trocar o valor esperado de um teste, pôr um `.skip`,
encurtar a revisão — e cada passo, sozinho, parece razoável. Num repositório de um dono só, o
agente roda com o token desse dono e poderia até aprovar o próprio PR.

## Decisão

1. **Loop:** skills `relatar-atrito` e `triar-atrito` (fila = issues com label `atrito`),
   `validar-antes-de-concluir` com `revisor-frio`, `cobrir-lacunas-de-teste`, auditoria da
   sessão (`conferir-sessao.mjs`) no fechamento da tarefa, mutação do PR (workflow `mutacao`).
2. **A barra** (`scripts/harness/barra.mjs`): guardas por caminho, cada uma com o sinal de
   afrouxar — qualquer mudança no código e na configuração da barra (também a que aperta),
   linha de teste que sai e não volta, pulo de teste novo, termo que some do texto no saldo do
   PR, dono que muda no CODEOWNERS.
3. **O conferidor** (`scripts/harness/conferir-fluxo.mjs`), rodado da `main` pelo workflow
   `fluxo` (`pull_request_target`, checkout só da `main`): PR que mexe na barra só passa com
   revisão aprovada no commit da ponta por quem não o escreveu, ou com o comentário
   `**Autorização do merge:**` com a citação literal e `**Commit:** <sha da ponta>`.
4. **O agente nunca aprova, faz merge nem escreve a autorização** (regra `no-merge-by-agent`).

## Alternativas consideradas

- **Auditoria selada** (a referência deixa a barra mudar sozinha se ela acusar tudo o que a
  barra da `main` acusa, numa suíte de PRs-armadilha num sandbox) — adiada: muito código para
  um template; num repositório de um dono só, a autorização do merge resolve com menos.
- **Exigir aprovação de qualquer PR do harness** — rejeitada: a maior parte das mudanças (uma
  skill nova, um texto) não mexe na régua, e a fricção em tudo faria a regra ser contornada.
- **Detectar só o que afrouxa** — rejeitada: máquina não separa apertar de afrouxar com
  certeza; aqui a pessoa decide, e o agente lista o que mudou.

## Consequências

- Este próprio PR de introdução mexe na barra inteira e precisa da autorização do dono.
- O loop fica auditável: atrito com trecho, triagem com vermelho, conserto com prova.
- **Limites:** a frase reescrita que afrouxa mantendo o termo não é acusada (revisão fria e quem
  lê); a autorização escrita por arquivo (`--body-file`) não é vista pela regra do motor — o
  conferidor ainda exige a citação literal; exigir o status `conferidor do fluxo` na proteção da
  `main` é configuração do dono, fora do repositório; o comentário de autorização é aceito de
  quem tem acesso ao repositório, inclusive o autor do PR — é o caminho do repositório de um dono
  só. Com uma segunda pessoa revisando, restrinja-o a quem não é o autor (ver "Revisar quando").
- **Os guardas são o melhor esforço, não a fronteira de segurança.** Duas rodadas de revisão fria
  acharam 22 formas de contorno (wrapper, `eval`, `xargs`, `| bash`, alias do PowerShell, API do
  GitHub); as achadas viraram casos na prova das regras. Outras existem: o que importa é que cada
  uma achada vira caso, e o que segura de verdade é a barra no CI.

## Revisar quando

- O repositório ganhar uma segunda pessoa que revisa (a autorização por comentário pode sair).
- Um PR afrouxar a régua sem ser acusado (vira teste da barra — skill `licao`).
- As guardas acusarem tanto PR legítimo que a autorização vire carimbo.
