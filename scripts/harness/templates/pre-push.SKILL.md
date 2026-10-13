---
name: pre-push
description: Roda localmente, na mesma ordem, os passos do CI antes de um push ou PR. Use sempre antes de git push, antes de abrir PR, ou quando o usuário perguntar se está pronto para subir. Nunca dê push "para ver se o CI passa".
---

# Pre-push — espelho do CI

Os passos abaixo são os do CI deste projeto, na mesma ordem. Se o CI mudar, esta skill
muda no mesmo commit.

<!-- pendente: os passos do CI, um por linha, com o comando exato; termine com o check do harness -->

Pare no primeiro vermelho e conserte; não pule passo. Se um passo não puder rodar aqui,
**diga qual não rodou** no resumo e no PR — passo pulado em silêncio parece aprovação.

Nunca: `--no-verify`, push para branch protegida, `--force` (o hook `bash-guard`
bloqueia os três).
