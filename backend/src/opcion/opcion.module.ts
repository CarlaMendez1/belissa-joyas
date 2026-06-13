import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Opcion } from './opcion.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([Opcion])],
  exports: [TypeOrmModule],
})
export class OpcionModule {}
