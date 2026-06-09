import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Subcategoria } from './subcategoria.entity';
import { SubcategoriaService } from './subcategoria.service';
import { SubcategoriaController } from './subcategoria.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Subcategoria])],
  providers: [SubcategoriaService],
  controllers: [SubcategoriaController],
  exports: [SubcategoriaService],
})
export class SubcategoriaModule {}