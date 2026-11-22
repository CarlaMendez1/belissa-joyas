import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Categoria } from './categoria.entity.js';
import { Opcion } from '../opcion/opcion.entity.js';
import { CategoriaService } from './categoria.service.js';
import { CategoriaController } from './categoria.controller.js';
import { UploadModule } from '../upload/upload.module.js';
import { AuditoriaModule } from '../auditoria/auditoria.module.js';

@Module({
  imports: [TypeOrmModule.forFeature([Categoria, Opcion]), AuditoriaModule, UploadModule],
  providers: [CategoriaService],
  controllers: [CategoriaController],
  exports: [CategoriaService],
})
export class CategoriaModule {}
