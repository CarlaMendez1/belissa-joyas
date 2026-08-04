import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Opcion } from './opcion.entity.js';
import { OpcionService } from './opcion.service.js';
import { OpcionController } from './opcion.controller.js';

@Module({
  imports: [TypeOrmModule.forFeature([Opcion])],
  providers: [OpcionService],
  controllers: [OpcionController],
  exports: [OpcionService],
})
export class OpcionModule {}