---
name: fechar-tarefa
description: Fecha uma tarefa de work/ destilando o aprendizado em guarda, ADR ou fato de memória, e apaga a pasta. Use quando todos os critérios do task.json passarem, quando o usuário disser que acabou ou abandonar a tarefa, ou quando o teto de tarefas abertas estourar.
---

# Fechar tarefa

A pasta da tarefa é memória **episódica**: serve enquanto o trabalho está vivo. Mantê-la
para sempre foi o que gerou, num dos projetos de origem, 634 pastas que ninguém relia.
O histórico fica no git; o que vale a pena lembrar sobe para um lugar durável.

1. **Critérios.** Todo `"passa": true` tem evidência citada no PROGRESS? Se algum não
   passa, diga ao usuário — fechar com critério aberto é decisão dele, e o motivo vai
   para o PROGRESS antes de apagar.
2. **Destile.** Releia o PROGRESS e pergunte, para cada achado:
   - Uma checagem teria evitado isto? → skill `licao` (teste → check/hook → skill).
   - Foi uma decisão com alternativas? → ADR em `docs/decisions/`.
   - É um fato não óbvio e durável sobre o código? → skill `memoria`.
   - Nenhum dos três? Então não registre. Registrar tudo é o mesmo que não registrar
     nada — e diga isso explicitamente no resumo.
3. **Verifique.** Os passos da skill `pre-push` verdes (ou diga o que ficou vermelho, o
   que não rodou, e por quê).
4. **Apague** a pasta `work/<slug>/` no mesmo commit que fecha o trabalho, com a
   mensagem citando o que foi destilado e para onde.
5. **Resumo ao usuário:** o que foi feito, o que foi verificado, **o que não foi
   verificado**, e o que foi destilado para onde.
