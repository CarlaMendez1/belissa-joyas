import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Carrito } from './carrito.entity.js';
import { ItemCarrito } from '../item-carrito/item-carrito.entity.js';
import { Variante } from '../variante/variante.entity.js';
import { CarritoService } from './carrito.service.js';
import { CarritoController } from './carrito.controller.js';

@Module({
  imports: [TypeOrmModule.forFeature([Carrito, ItemCarrito, Variante])],
  providers: [CarritoService],
  controllers: [CarritoController],
  exports: [CarritoService],
})
export class CarritoModule {}