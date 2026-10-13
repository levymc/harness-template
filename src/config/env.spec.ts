import { validateEnv } from './env.js';

describe('validateEnv', () => {
  it('aceita a configuração do .env.example', () => {
    const env = validateEnv({ PORT: '3000', DATABASE_URL: 'postgres://app:app@localhost:5433/app' });
    expect(env.PORT).toBe(3000);
  });

  it('recusa DATABASE_URL ausente com mensagem que aponta o .env.example', () => {
    expect(() => validateEnv({})).toThrow(/\.env\.example/);
  });
});
