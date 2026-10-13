-- Migrations são só "up", em SQL puro, e nunca editadas depois de aplicadas em algum
-- ambiente compartilhado: corrigir é escrever a próxima. Ver docs/decisions/0002-*.md.
CREATE TABLE IF NOT EXISTS items (
  id         uuid PRIMARY KEY,
  name       varchar(200) NOT NULL,
  done       boolean      NOT NULL DEFAULT false,
  created_at timestamptz  NOT NULL DEFAULT now(),
  updated_at timestamptz  NOT NULL DEFAULT now()
);
