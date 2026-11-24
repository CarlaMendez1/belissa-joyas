import { Module } from '@nestjs/common';
import { EstadisticasService } from './estadisticas.service.js';
import { ConfiguracionModule } from '../configuracion/configuracion.module.js';
import { EstadisticasController } from './estadisticas.controller.js';

@Module({
  imports: [ConfiguracionModule],
  providers: [EstadisticasService],
  controllers: [EstadisticasController],
})
export class EstadisticasModule {}
