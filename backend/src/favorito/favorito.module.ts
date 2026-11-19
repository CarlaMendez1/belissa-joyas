import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Favorito } from './favorito.entity.js';
import { Producto } from '../producto/producto.entity.js';
import { FavoritoService } from './favorito.service.js';
import { FavoritoController } from './favorito.controller.js';

@Module({
  imports: [TypeOrmModule.forFeature([Favorito, Producto])],
  providers: [FavoritoService],
  controllers: [FavoritoController],
})
export class FavoritoModule {}
