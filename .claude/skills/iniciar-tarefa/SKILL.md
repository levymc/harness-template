---
name: iniciar-tarefa
description: Abre uma tarefa em work/ com task.json (objetivo e critérios de aceite) e PROGRESS.md. Use antes de qualquer trabalho que não caiba numa única resposta — feature, bug com investigação, refatoração, migração — ou quando o trabalho puder continuar em outra sessão ou máquina.
---

# Iniciar tarefa

Tarefa pequena (um arquivo, uma resposta) não precisa disto. Na dúvida, abra: o custo é
um minuto, e a próxima sessão — sua ou de outro agente — começa sabendo onde parou (o
hook SessionStart imprime as tarefas abertas).

1. Veja se já existe uma aberta para o mesmo assunto em `work/`. Continue nela.
2. Teto: `harness.config.json` → `ceilings.openTasks`. Cheio? Feche uma antes
   (skill `fechar-tarefa`) — tarefa aberta esquecida é ruído em toda sessão.
3. Crie `work/<YYYY-MM-DD>-<slug>/task.json`:

   ```json
   {
     "objetivo": "uma frase, do ponto de vista de quem pediu",
     "contexto": "por que agora; links para issue/conversa",
     "criterios": [
       { "descricao": "comportamento observável e verificável", "passa": false }
     ],
     "fora_de_escopo": ["o que NÃO será feito"]
   }
   ```

   Critério bom é verificável por teste ou comando. Todos começam `"passa": false` —
   uma sessão futura que vê tudo `true` sem evidência não pode concluir que acabou.
   JSON e não Markdown: o modelo sobrescreve menos um campo estruturado.

4. Crie `PROGRESS.md` ao lado. **Append-only**; cada entrada:

   ```markdown
   ### 2026-10-13 14:05 — <o que foi feito>
   - decisão/achado: …
   - próximo passo: …
   ```

5. Critério só vira `"passa": true` com evidência (teste, comando, print) citada na
   entrada do PROGRESS. Nunca apague nem reescreva um critério para fazê-lo passar;
   mudar escopo é com o usuário.
