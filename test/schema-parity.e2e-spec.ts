import type { INestApplication } from '@nestjs/common';
import { Sequelize } from 'sequelize-typescript';
import { createApp } from './setup-app.js';

/**
 * Todo atributo de todo model existe como coluna no banco MIGRADO.
 *
 * É a guarda contra o defeito mais caro deste tipo de stack: alguém acrescenta uma coluna
 * ao model e esquece a migration. Tipo passa, unit test com mock passa, e em produção toda
 * query daquele model devolve 500. Este teste lê os models registrados no Sequelize — não
 * uma lista à mão, que envelheceria — e confere contra o information_schema.
 */
describe('paridade model ↔ schema (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createApp();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('todo model tem tabela e toda coluna declarada existe', async () => {
    const sequelize = app.get(Sequelize);
    const models = Object.values(sequelize.models);
    expect(models.length).toBeGreaterThan(0);

    const faltando: string[] = [];
    for (const model of models) {
      const tabela = model.getTableName() as string;
      const [linhas] = await sequelize.query(
        'select column_name from information_schema.columns where table_schema = current_schema() and table_name = :tabela',
        { replacements: { tabela } },
      );
      const colunas = new Set((linhas as { column_name: string }[]).map((l) => l.column_name));
      if (!colunas.size) {
        faltando.push(`${tabela}: tabela não existe (falta migration?)`);
        continue;
      }
      for (const atributo of Object.values(model.getAttributes())) {
        const coluna = atributo.field ?? '';
        if (!colunas.has(coluna)) faltando.push(`${tabela}.${coluna}`);
      }
    }
    expect(faltando, 'colunas do model sem migration correspondente').toEqual([]);
  });
});
