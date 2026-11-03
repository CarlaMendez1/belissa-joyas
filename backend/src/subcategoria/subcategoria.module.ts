import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Subcategoria } from './subcategoria.entity.js';
import { SubcategoriaService } from './subcategoria.service.js';
import { SubcategoriaController } from './subcategoria.controller.js';
import { AuditoriaModule } from '../auditoria/auditoria.module.js';

@Module({
  imports: [TypeOrmModule.forFeature([Subcategoria]), AuditoriaModule],
  providers: [SubcategoriaService],
  controllers: [SubcategoriaController],
  exports: [SubcategoriaService],
})
export class SubcategoriaModule {}
