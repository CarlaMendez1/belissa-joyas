import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Carrito } from '../carrito/carrito.entity.js';
import { ItemCarrito } from '../item-carrito/item-carrito.entity.js';
import { Variante } from '../variante/variante.entity.js';
import { Venta } from '../venta/venta.entity.js';
import { DetalleVenta } from '../venta/detalle-venta.entity.js';
import { Pago } from './pago.entity.js';
import { PagoService } from './pago.service.js';
import { PagoController } from './pago.controller.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Carrito, ItemCarrito, Variante, Venta, DetalleVenta, Pago]),
  ],
  providers: [PagoService],
  controllers: [PagoController],
})
export class PagoModule {}