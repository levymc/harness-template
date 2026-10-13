---
name: licao
description: Transforma uma falha, um bug ou um "verde que mentia" em guarda permanente, subindo a escada teste → regra de check/hook → linha de skill → fato de memória, e prova que a guarda pega. Use depois de corrigir um bug que poderia voltar, quando um teste passou pelo motivo errado, quando uma instrução escrita no repo estava errada, ou quando o usuário corrigir o mesmo erro duas vezes.
---

# Lição → guarda

Prosa não falha, então decai; código falha, então permanece.

## 1. Escolha o degrau mais alto que funciona

1. **Teste na suíte** — quando o defeito é comportamento (`src/**/*.spec.ts`,
   `test/**/*.e2e-spec.ts`).
2. **Regra no `scripts/harness/check-claims.mjs`** ou **hook em `.claude/hooks/`** —
   quando é forma, coerência ou ação perigosa. Regra nova entra no array `RULES` com
   `id`, `descricao` e mensagem de erro que **diz como consertar** (o agente lê a
   mensagem; ela é a instrução).
3. **Linha numa skill ou agente** — quando é procedimento que nenhum código verifica.
4. **Fato de memória** (skill `memoria`) — quando é conhecimento sem checagem possível.

## 2. Prove que pega

Introduza a regressão de propósito → veja **vermelho** → reverta → veja verde. Uma
checagem nunca vista falhar é decoração. Faça isso com o script, que reverte sempre:

```bash
node scripts/harness/prove.mjs <arquivo-da-guarda> --de '<trecho que a faz funcionar>' --para '' --cmd '<comando que roda o teste>'
```

Exit 0 = a verificação ficou vermelha (pega). Exit 1 = continuou verde: a guarda, ou o
teste dela, passa pelo motivo errado. Ao escrever os testes deste harness, isso
aconteceu duas vezes com testes que pareciam corretos na leitura.

Para regra de check e hook, o teste vai em `scripts/harness/test/` e cobre os **dois
sentidos**: o que tem de pegar e o que NÃO pode pegar (falso positivo desliga guarda
na primeira semana).

Armadilhas já pagas:
- guarda textual procura a **chamada** (`fn(`), não o nome — o `import` sozinho
  satisfaz uma regra que procura o nome;
- teste de resolvedor entra pela porta que resolve;
- teste que lê de volta pelo mesmo caminho que esconde o defeito não prova nada.

## 3. Registre a origem e a expiração

- Linha em `docs/guardrails.md`: nunca | por quê | sensor | origem | expira quando.
- O comentário no topo da regra/hook conta o incidente — quem pensar em remover a
  guarda precisa saber o que ela evitou.
- Se um fato de memória cobria isto, marque-o `superseded` apontando para a guarda.

## 4. Pode, e deve, concluir que não generaliza

Se a lição só valia para aquele caso, diga isso ao usuário e não escreva nada.
