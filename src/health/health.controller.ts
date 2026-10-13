import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { Sequelize } from 'sequelize-typescript';

@Controller('health')
export class HealthController {
  constructor(private readonly sequelize: Sequelize) {}

  @Get()
  async check() {
    try {
      await this.sequelize.authenticate();
      return { status: 'ok', db: 'up' };
    } catch {
      throw new ServiceUnavailableException({ status: 'error', db: 'down' });
    }
  }
}
