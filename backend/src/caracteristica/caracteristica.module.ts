import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Opcion } from '../opcion/opcion.entity.js';
import { Caracteristica } from './caracteristica.entity.js';
import { CaracteristicaService } from './caracteristica.service.js';
import { CaracteristicaController } from './caracteristica.controller.js';
import { AuditoriaModule } from '../auditoria/auditoria.module.js';

@Module({
  imports: [TypeOrmModule.forFeature([Caracteristica, Opcion]), AuditoriaModule],
  providers: [CaracteristicaService],
  controllers: [CaracteristicaController],
  exports: [CaracteristicaService],
})
export class CaracteristicaModule {}
