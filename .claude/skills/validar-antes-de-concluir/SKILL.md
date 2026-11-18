---
name: validar-antes-de-concluir
description: 'Roda a verificação antes do "pronto": o gate inteiro na ordem do CI, a prova do comportamento, a releitura hostil do diff e a revisão de um agente novo. Use quando for afirmar "concluído", "corrigido" ou "passando", antes de push ou PR, e enquanto o gate não passa.'
---

# Validar antes de dizer "concluído"

"Pronto" é uma afirmação, e afirmação não verificada é o defeito mais comum em projeto
trabalhado por agente. Esta skill é o que separa "acho que funciona" de "vi funcionar".

## 1. Rode o gate inteiro, na ordem do CI

Os passos e a ordem estão na skill `pre-push`, que espelha o workflow de CI. Rode
um por vez e pare no primeiro vermelho; corrija a causa e recomece do passo que falhou.

"Passou" só vale quando a sequência inteira fica verde **na mesma rodada**. Um teste filtrado
serve para iterar, nunca para afirmar que acabou. Se um passo não roda por falta de ambiente
(banco para o e2e, por exemplo), diga qual e por quê; não infira o resultado de um pelo outro:
teste verde não prova build verde, e build verde não prova teste verde.

### Pare na segunda falha igual

Anote cada vermelho antes de tentar de novo:

```bash
node scripts/harness/falhas.mjs falhou --teste "<nome do teste ou passo>" --mensagem "<linha de erro, copiada>" --tentativa "<o que você mudou>"
node scripts/harness/falhas.mjs passou
```

A mesma falha duas vezes seguidas (mesmo teste, mesma mensagem, sem contar hora e duração)
faz o script sair com 3 e gravar o rascunho do bloqueio em `.harness/tentativas.bloqueio.md`.
**Pare de mexer no código**: copie o rascunho para o `PROGRESS.md` da tarefa e leve a decisão
ao usuário. A terceira tentativa com a mesma hipótese gasta tempo e não traz informação nova —
e é nela que o agente começa a afrouxar o teste. Se o harness atrapalhou, skill `relatar-atrito`.

## 2. Prove o comportamento visível

Gate verde prova que compila e que os testes passam, não que o fluxo funciona. Se a mudança
aparece para alguém (resposta de API, mensagem, CLI, hook), exercite o fluxo que você tocou,
ponta a ponta: suba a aplicação e chame o endpoint, rode o script como o usuário rodaria,
dispare o hook com o JSON que o Claude Code mandaria. Refactor sem superfície e coberto por
teste dispensa este passo — diga que dispensou e por quê.

## 3. Pague a dívida que a mudança criou

Tire o atalho que você mesmo deixou: `TODO`/`FIXME` novo, teste pulado ou focado (`.skip`,
`.only`, `.todo`), código comentado, teto ou baseline afrouxado, regra trocada para `warn` ou
`off`, bypass de hook. Mexeu em algo da **barra** (`docs/harness.md`)? Isso vai declarado ao
usuário, nunca escondido no meio do diff.

## 4. Releia o diff como revisor hostil

`git diff origin/main...HEAD`, assumindo que está errado: entrada vazia, nulo virando texto
vazio, erro ou timeout da dependência, caminho no Windows, segredo vazando, instrução que cita
caminho ou comando que não existe, teste que passaria sem a mudança. Siga só quando essa
leitura não achar mais nada.

## 5. Peça a revisão em contexto frio

Quem escreveu tende a defender o próprio diff. Um agente novo lê a mudança sem a conversa:
só o critério de aceite, as decisões declaradas, o diff e a saída do gate desta rodada.

1. **Commite** (o revisor lê só o diff dos commits) e salve a saída de cada passo do gate num
   arquivo em `.harness/`. Monte o pedido:

   ```bash
   node scripts/harness/revisao-fria.mjs pedido --tarefa work/<pasta> --comando "<comando do gate>" --saida .harness/gate.txt [--decisoes .harness/decisoes.md]
   ```

   O critério sai do `task.json`. `--decisoes` é uma lista curta das escolhas que você fez
   (valor padrão, corte de escopo) — afirmações, não raciocínio. O script recusa mudança fora
   de commit e opção a mais; tira `work/` e `.harness/` do diff; com commit `feat` na branch,
   acrescenta a lente "funcionalidade nativa" (`references/funcionalidade-nativa.md`).
2. **Chame o subagente `revisor-frio`** com a frase que o script imprimiu, sem uma palavra a
   mais. Nunca um fork: ele herda a conversa.
3. **Confira a resposta:** `node scripts/harness/revisao-fria.mjs achados`. Aceita só achado
   com arquivo e linha, ou `Nada a apontar.`
4. **Resolva cada achado**: corrija, ou diga ao usuário por que não procede. O revisor é um
   modelo: pode errar e pode concordar demais. Ele aponta; quem conduz decide.
5. **Pare quando nada bloqueia.** Todo agente novo acha algo. Bloqueia: comportamento errado,
   falha de segurança, perda de dado, teste que não prova o que diz, critério que o diff não
   cumpre. O resto vira nota no PROGRESS ou tarefa nova. Depois de corrigir o que bloqueia,
   uma nova revisão; quando ela não trouxer bloqueio, acabou.

## Critério de "feito"

- [ ] Gate inteiro verde na mesma rodada, com a saída vista.
- [ ] Nenhuma falha repetida ignorada: a segunda falha igual parou as tentativas.
- [ ] Comportamento visível exercitado, ou o motivo de não precisar.
- [ ] Nenhuma dívida nova no diff; mudança na barra declarada.
- [ ] Diff relido como revisor hostil.
- [ ] Revisão fria feita; a última sem achado que bloqueia.
- [ ] No resumo ao usuário: o que passou, o que falhou e **o que não rodou**, com o mesmo
      destaque.
