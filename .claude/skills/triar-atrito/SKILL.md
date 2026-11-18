---
name: triar-atrito
description: 'Tria a fila de issues de atrito com o harness, da mais antiga à mais nova: reproduz na main, classifica e só aceita a correção com um teste novo que falha antes do conserto. Use quando o usuário pedir a triagem dos atritos, na jardinagem, ou quando a fila crescer.'
---

# Triar atrito

A triagem transforma relato em mudança provada. A regra central: **defeito do harness só é
aceito com o teste novo vermelho contra a `main`**. É o vermelho que prova que o defeito existe
— e, depois do conserto, é ele que vira a guarda (skill `licao`).

## O fluxo

1. **A fila**, da issue mais antiga para a mais nova:

   ```bash
   node scripts/harness/atrito.mjs fila
   ```

2. **Reproduza na `main` atual**, não na branch de quem relatou: num worktree limpo de
   `origin/main`. Leia o visto do relato e o turno citado; o deduzido é só hipótese.
3. **Classifique:** `skill`, `script`, `hook`, `regra`, `documentação` ou `fora do harness`
   (defeito do produto, da ferramenta do agente, de serviço externo).
4. **Escreva o teste que reproduz** o defeito e rode-o na `main`: tem de ficar **vermelho**.
   Teste que passa na `main` não prova defeito — volte ao passo 2.
5. **Registre a triagem** em `.harness/triagem.json`:

   ```json
   {
     "issue": 12,
     "classe": "regra",
     "reproduzido": { "resultado": "sim", "como": "rodei X na main e Y aconteceu" },
     "causa": "a regex trata a aspa como fim do comando",
     "correcao": { "arquivo": "scripts/harness/rules/no-force-push.mjs", "teste": "o caso novo na proof da regra", "vermelho": "<saída do teste falhando na main>" }
   }
   ```

   Para `fora do harness`, troque `correcao` por `"destino": "para onde vai"`.

   ```bash
   node scripts/harness/atrito.mjs triagem .harness/triagem.json
   ```

   O script recusa defeito sem o vermelho (e "✖ 0 problems" ou "# fail 0" não são vermelho).
   Com o OK do usuário, publique o comentário com o `gh issue comment` que ele imprimiu.
6. **O conserto** é tarefa comum: skill `iniciar-tarefa`, o teste vermelho vira verde, a escada
   da `licao` decide se sobe para regra ou hook. Se o conserto mexe na **barra**
   (`docs/harness.md`), o PR precisa da decisão de quem não o escreveu.

## Padrões

- Três atritos da mesma skill no mesmo mês viram **uma** mudança na skill, não três consertos.
- Atrito não reproduzido fica aberto com o que foi tentado; não feche por cansaço.
- "Bloqueio errado" de hook se conserta na regra (o caso vizinho entra no `allows` da prova),
  nunca desligando a regra.
