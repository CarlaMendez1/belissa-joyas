import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Caracteristica } from './caracteristica.entity.js';
import { CaracteristicaService } from './caracteristica.service.js';
import { CaracteristicaController } from './caracteristica.controller.js';

@Module({
  imports: [TypeOrmModule.forFeature([Caracteristica])],
  providers: [CaracteristicaService],
  controllers: [CaracteristicaController],
  exports: [CaracteristicaService],
})
export class CaracteristicaModule {}