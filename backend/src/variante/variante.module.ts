import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Variante } from './variante.entity.js';
import { Caracteristica } from '../caracteristica/caracteristica.entity.js';
import { VarianteService } from './variante.service.js';
import { VarianteController } from './variante.controller.js';
import { UploadModule } from '../upload/upload.module.js';

@Module({
  imports: [TypeOrmModule.forFeature([Variante, Caracteristica]), UploadModule],
  providers: [VarianteService],
  controllers: [VarianteController],
  exports: [VarianteService],
})
export class VarianteModule {}