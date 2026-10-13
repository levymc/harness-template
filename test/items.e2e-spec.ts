import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createApp } from './setup-app.js';

describe('items (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('cria, lê de volta, atualiza e apaga — os valores atravessam o banco', async () => {
    const http = request(app.getHttpServer());
    const criado = await http.post('/items').send({ name: 'comprar pão' }).expect(201);
    expect(criado.body).toMatchObject({ name: 'comprar pão', done: false });

    // Ler de volta pelo GET, não confiar no eco do POST: um campo de classe que sombreia
    // o getter do Sequelize devolve undefined aqui e passaria numa asserção só do POST.
    const lido = await request(app.getHttpServer()).get(`/items/${criado.body.id}`).expect(200);
    expect(lido.body.name).toBe('comprar pão');

    await request(app.getHttpServer()).patch(`/items/${criado.body.id}`).send({ done: true }).expect(200);
    const feito = await request(app.getHttpServer()).get(`/items/${criado.body.id}`).expect(200);
    expect(feito.body.done).toBe(true);

    await request(app.getHttpServer()).delete(`/items/${criado.body.id}`).expect(204);
    await request(app.getHttpServer()).get(`/items/${criado.body.id}`).expect(404);
  });

  it('recusa corpo inválido com 400, não 500', async () => {
    await request(app.getHttpServer()).post('/items').send({ name: '' }).expect(400);
    await request(app.getHttpServer()).post('/items').send({ name: 'x', extra: 1 }).expect(400);
  });

  it('health responde com o banco de pé', async () => {
    await request(app.getHttpServer()).get('/health').expect(200, { status: 'ok', db: 'up' });
  });
});
