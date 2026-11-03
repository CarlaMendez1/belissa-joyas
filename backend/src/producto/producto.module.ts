import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Producto } from './producto.entity.js';
import { ProductoService } from './producto.service.js';
import { ProductoController } from './producto.controller.js';
import { UploadModule } from '../upload/upload.module.js';
import { AuditoriaModule } from '../auditoria/auditoria.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Producto]),
    UploadModule,
    AuditoriaModule,
  ],
  providers: [ProductoService],
  controllers: [ProductoController],
  exports: [ProductoService],
})
export class ProductoModule {}
