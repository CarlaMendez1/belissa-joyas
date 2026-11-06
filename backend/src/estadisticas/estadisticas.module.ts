import { Module } from '@nestjs/common';
import { EstadisticasService } from './estadisticas.service.js';
import { EstadisticasController } from './estadisticas.controller.js';

@Module({
  providers: [EstadisticasService],
  controllers: [EstadisticasController],
})
export class EstadisticasModule {}
