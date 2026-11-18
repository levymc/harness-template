/**
 * O catálogo das regras de ação do agente. Regra nova: um arquivo nesta pasta, com o
 * contrato de `engine.mjs` (prova inclusa), e uma linha aqui. Uma seção em `docs/regras.md`
 * com o id como título (a mensagem de bloqueio aponta para ela). Ver ADR 0006.
 */
import commitMessageFormat from './commit-message-format.mjs'
import forbiddenTerm from './forbidden-term.mjs'
import noDiscardWork from './no-discard-work.mjs'
import noForcePush from './no-force-push.mjs'
import noHiddenCommand from './no-hidden-command.mjs'
import noMergeByAgent from './no-merge-by-agent.mjs'
import noRecursiveDelete from './no-recursive-delete.mjs'
import noRemoteMigration from './no-remote-migration.mjs'
import noSecretAccess from './no-secret-access.mjs'
import noVerifyBypass from './no-verify-bypass.mjs'
import protectedBranch from './protected-branch.mjs'

export const CATALOG = Object.freeze([
  forbiddenTerm,
  noHiddenCommand,
  noSecretAccess,
  noRemoteMigration,
  noRecursiveDelete,
  noVerifyBypass,
  protectedBranch,
  noForcePush,
  noDiscardWork,
  noMergeByAgent,
  commitMessageFormat,
])
