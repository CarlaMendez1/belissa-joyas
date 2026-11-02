import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Caracteristica } from './caracteristica.entity.js';
import { CaracteristicaService } from './caracteristica.service.js';
import { CaracteristicaController } from './caracteristica.controller.js';
import { Opcion } from '../opcion/opcion.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([Caracteristica, Opcion])],
  providers: [CaracteristicaService],
  controllers: [CaracteristicaController],
  exports: [CaracteristicaService],
})
export class CaracteristicaModule {}