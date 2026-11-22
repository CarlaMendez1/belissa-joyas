import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CarruselInicio } from './carrusel.entity.js';
import { CarruselService } from './carrusel.service.js';
import { CarruselController } from './carrusel.controller.js';
import { ProductoModule } from '../producto/producto.module.js';
import { AuditoriaModule } from '../auditoria/auditoria.module.js';

@Module({
  imports: [TypeOrmModule.forFeature([CarruselInicio]), ProductoModule, AuditoriaModule],
  providers: [CarruselService],
  controllers: [CarruselController],
})
export class CarruselModule {}
