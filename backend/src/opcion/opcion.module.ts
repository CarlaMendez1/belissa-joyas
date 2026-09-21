import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Opcion } from './opcion.entity.js';
import { Categoria } from '../categoria/categoria.entity.js';
import { Caracteristica } from '../caracteristica/caracteristica.entity.js';
import { OpcionService } from './opcion.service.js';
import { OpcionController } from './opcion.controller.js';

@Module({
  imports: [TypeOrmModule.forFeature([Opcion, Categoria, Caracteristica])],
  providers: [OpcionService],
  controllers: [OpcionController],
  exports: [OpcionService],
})
export class OpcionModule {}