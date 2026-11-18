---
name: relatar-atrito
description: 'Relata um atrito com o harness (skill, hook, regra ou documentação que atrapalhou ou deixou passar) como issue com o label atrito, com o trecho literal da sessão e sem segredo. Use quando o harness atrapalhar, um bloqueio parecer errado ou a conferir-sessao achar falta.'
---

# Relatar atrito

O harness só melhora pelo que o atrapalhou de verdade. Atrito contado de memória vira
opinião; o trecho literal da sessão, com o número do turno, deixa quem tria conferir.

Atrito é: um hook que barrou o que não devia (ou deixou passar o que devia barrar), uma skill
que mandou fazer o errado ou não disparou, um comando documentado que não existe, uma regra do
check que acusou falso, uma falta que a `conferir-sessao` achou. **Não** é atrito o defeito do
produto — esse é tarefa comum.

## 1. Ache a sessão e o turno

```bash
node scripts/harness/sessao.mjs achar
node scripts/harness/sessao.mjs ler <sessao.jsonl>
```

A leitura já sai com segredo mascarado. Ache o turno onde o atrito aparece — o comando
barrado, a saída que mentiu, a instrução seguida.

## 2. Escreva o relato, separando o visto do deduzido

`.harness/atrito.json`:

```json
{
  "titulo": "uma frase: o que atrapalhou",
  "onde": "skill pre-push | hook bash-guard | regra no-recursive-delete | check-claims:cited-path | …",
  "visto": [{ "turno": 38, "trecho": "texto copiado literal da leitura" }],
  "deduzido": "o que você acha que causou — não conferido",
  "esperado": "o que devia ter acontecido"
}
```

- **visto** é citação literal: copie da leitura, não reescreva. O script recusa citação que
  não está no turno.
- **deduzido** é hipótese, e fica marcado assim. Quem tria reproduz antes de acreditar.

```bash
node scripts/harness/atrito.mjs gerar .harness/atrito.json --sessao <sessao.jsonl>
```

Recusa visto vazio, citação inventada e qualquer coisa com cara de segredo.

## 3. Procure duplicata, depois publique com o OK do usuário

```bash
node scripts/harness/atrito.mjs fila
```

Se já há issue sobre o mesmo ponto (mesma skill e passo, ou mesmo sintoma), comente nela em vez
de abrir outra. Senão, **mostre o corpo ao usuário** e, com o OK dele, rode o `gh issue create`
que o script imprimiu. Publicar é ação para fora; o rascunho não. Sem `gh`, o texto pronto está
em `.harness/atrito.md`.

## Depois

A triagem (skill `triar-atrito`) reproduz o atrito na `main` e só aceita a correção com um
teste que falha antes do conserto. Não conserte o harness no meio da tarefa em que o atrito
apareceu — a correção sai num PR próprio, julgado pela barra (`docs/harness.md`).
