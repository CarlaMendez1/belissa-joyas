import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Provincia } from './provincia.entity.js';
import { DireccionEnvio } from './direccion-envio.entity.js';
import { TarifaEnvio } from './tarifa-envio.entity.js';
import { EnviosService } from './envios.service.js';
import { EnviosController } from './envios.controller.js';
import { DireccionesController } from './direcciones.controller.js';
import { ConfiguracionModule } from '../configuracion/configuracion.module.js';
import { AuditoriaModule } from '../auditoria/auditoria.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Provincia, DireccionEnvio, TarifaEnvio]),
    ConfiguracionModule,
    AuditoriaModule,
  ],
  providers: [EnviosService],
  controllers: [EnviosController, DireccionesController],
  exports: [EnviosService],
})
export class EnviosModule {}
