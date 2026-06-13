import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Subcategoria } from './subcategoria.entity.js';
import { SubcategoriaService } from './subcategoria.service.js';
import { SubcategoriaController } from './subcategoria.controller.js';

@Module({
  imports: [TypeOrmModule.forFeature([Subcategoria])],
  providers: [SubcategoriaService],
  controllers: [SubcategoriaController],
  exports: [SubcategoriaService],
})
export class SubcategoriaModule {}