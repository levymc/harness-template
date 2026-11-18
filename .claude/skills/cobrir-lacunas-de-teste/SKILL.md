---
name: cobrir-lacunas-de-teste
description: Acha a regra que a entrega toca sem teste, escreve o teste que falta e prova que ele pega o erro, por mutação ou sabotagem. Use quando a entrega mudar regra de negócio ou de guarda, antes de concluir uma tarefa, ou ao revisar lógica nova.
---

# Cobrir as lacunas de teste da entrega

Uma entrega quase sempre toca regra que a suíte não exercita. Três movimentos: **achar a
lacuna, cobrir com teste, provar que cobriu**. O alvo é comportamento, não percentual de
linha: a regra que o código afirma, o valor padrão que decide o que alguém recebe, o número
que vem do outro lado de uma fronteira.

O achado não é palpite. Uma sabotagem que sobrevive (o código trocado de propósito e a suíte
ainda verde) é uma linha de comportamento que pode quebrar sem nenhum teste reclamar: a
lacuna, apontada com precisão. O teste novo existe para matá-la, e a sabotagem rodada de
novo, agora pega, é o critério de pronto.

## Regras

- **Só o recorte da entrega**: os arquivos que a branch mudou desde a base e o comportamento
  que eles tocam. Nada de varrer o repositório.
- **Leia na fonte antes de afirmar.** Antes de escrever um teste, confirme por busca que ele
  ainda não existe.
- **O entregável é teste**, verde e que pega a sabotagem que sobrevivia.
- **Invariante, não exemplo.** `esperar que o texto contenha "Encontrados 51"` fica verde com
  o campo sendo contagem e sendo piso: passa antes e depois da regressão.
- **Fixture que distingue.** Se o teste separa dois valores (o total e os itens da página), a
  fixture não pode ter os dois iguais.
- **Nível pela lacuna.** Unidade para regra pura; integração para fronteira (servidor ou banco
  de verdade, nunca mock de módulo do próprio sistema); e2e só com alvo real. Método: skill
  `testes-agenticos`.
- **O jeito do repositório.** Reuse o runner e as fixtures que existem (o AGENTS.md diz quais);
  para o harness, `node:test` com `scripts/harness/test/fixture.mjs`. Runner novo só depois de
  provar, lendo o repositório, que não há um.
- **Limites honestos.** O que depende do outro lado de uma fronteira fica declarado, não
  fingido. Cenário sem alvo vira pendência declarada, não teste de mentira.
- **Sem segredo** em teste, fixture ou exemplo.

## O fluxo

1. **Delimite o recorte:** `node scripts/harness/recorte.mjs --base origin/main`. Separa
   código sem teste que o cite (lacuna provável), código com teste mas sem teste mudado junto,
   o par mudado junto, e os outros arquivos. É ponto de partida por nome e import, não
   veredito.
2. **Ache as lacunas pela sabotagem.** Para cada regra do recorte: que troca plausível a suíte
   deixa passar? Boas trocas: a fronteira (`>=` por `>`), o valor padrão, o campo trocado por
   outro do mesmo tipo, o ramo de erro devolvendo sucesso, a condição negada.

   ```bash
   node scripts/harness/prove.mjs <arquivo> --de "<trecho que existe uma vez>" --para "<trecho errado>" --cmd "<comando da suíte>"
   node scripts/harness/prove.mjs --lista .harness/sabotagens.json --cmd "<comando da suíte>"
   ```

   A lista é `[{ "arquivo": "…", "de": "…", "para": "…" }]`. A suíte tem de estar verde antes
   (o script confere); o trecho, aparecer uma vez só. Sai 0 quando a suíte pega todas, 1
   quando alguma sobrevive (a lacuna), 2 quando não deu para sabotar. Enquanto ele roda, não
   rode o gate nem a revisão fria no mesmo worktree: os dois leriam o código sabotado. Corrida
   cortada é desfeita na chamada seguinte (`.harness/prova-pendente.json`).

   Se o repositório tem a mutação do PR configurada (no template, o script `mutation` do
   package.json e o workflow de mutação do CI), ela faz o mesmo em escala, só nas linhas
   novas da branch. Rode antes do push com os modos `planejar --base origin/main` (mostra as
   fatias) e `rodar --alvo <harness|produto> --arquivos "<fatia>"` (roda uma). Cada
   sobrevivente pede, nesta ordem: um teste que o mate; simplificar o código; só então
   `// Stryker disable next-line <operador>: <motivo>` — sem motivo, o `planejar` recusa.
   O alvo `harness` muta os arquivos no lugar — inclusive os hooks que esta sessão usa: rode-o
   em primeiro plano e não rode outro comando até ele terminar e devolver os originais.
3. **Desenhe o teste de cada lacuna:** o nível, a invariante que a sabotagem sobrevivente
   mostra, a fixture com os valores em disputa diferentes.
4. **Escreva os testes.**
5. **Prove.** A mesma sabotagem de novo: agora ela morre. A suíte inteira: verde, sem aviso
   novo. As duas saídas vão para o `PROGRESS.md` como evidência do critério.
6. **Declare os limites:** fronteira de serviço, e2e sem ambiente, e a correção que é de tipo
   e não de teste (teste defende contra reintrodução; tipo, contra introdução).

## Com as outras skills

- `licao`: quando a lacuna é uma guarda do harness, a escada dela decide onde o teste mora.
- `validar-antes-de-concluir`: o gate inteiro antes do "pronto". Esta skill entra antes.
