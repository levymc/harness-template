import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module.js';

/**
 * Sobe o app inteiro contra o Postgres do docker compose, com o schema das migrations.
 * Pré-requisito: `pnpm db:up && pnpm db:migrate`. Sem banco, o e2e falha alto no
 * beforeAll — nunca pula em silêncio.
 */
export async function createApp(): Promise<INestApplication> {
  process.loadEnvFile?.('.env');
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  await app.init();
  return app;
}
