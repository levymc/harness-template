// class-transformer lê metadata de decorator; fora do Nest ninguém carrega isto por nós.
import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { IsInt, IsOptional, IsString, Matches, Max, Min, validateSync } from 'class-validator';

/**
 * Toda variável que o código lê está declarada aqui E no `.env.example`.
 * O boot confere este lado; a regra `env-example` do check-claims confere o outro.
 */
export class Env {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT: number = 3000;

  @IsString()
  @Matches(/^postgres(ql)?:\/\//, { message: 'DATABASE_URL precisa ser uma URL postgres://' })
  DATABASE_URL: string;
}

export function validateEnv(raw: Record<string, unknown>): Env {
  const env = plainToInstance(Env, raw, { enableImplicitConversion: true });
  const errors = validateSync(env, { skipMissingProperties: false });
  if (errors.length) {
    const detail = errors.map((e) => Object.values(e.constraints ?? {}).join(', ')).join('; ');
    throw new Error(`Configuração inválida: ${detail}. Veja o .env.example.`);
  }
  return env;
}
