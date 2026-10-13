import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SequelizeModule } from '@nestjs/sequelize';
import type { Env } from '../config/env.js';

/**
 * `synchronize: false` é invariante, não preferência: o schema só muda por migration
 * versionada em `migrations/`. A regra `no-sync` do check-claims guarda isto.
 */
@Module({
  imports: [
    SequelizeModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        dialect: 'postgres',
        uri: config.get('DATABASE_URL', { infer: true }),
        autoLoadModels: true,
        synchronize: false,
        logging: false,
      }),
    }),
  ],
})
export class DatabaseModule {}
