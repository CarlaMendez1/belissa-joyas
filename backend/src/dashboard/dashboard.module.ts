import { Module } from '@nestjs/common';
import { DashboardService } from './dashboard.service.js';
import { DashboardController } from './dashboard.controller.js';
import { ConfiguracionModule } from '../configuracion/configuracion.module.js';

@Module({
  imports: [ConfiguracionModule],
  providers: [DashboardService],
  controllers: [DashboardController],
})
export class DashboardModule {}
