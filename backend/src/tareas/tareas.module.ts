
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Carrito } from '../carrito/carrito.entity.js';
import { ItemCarrito } from '../item-carrito/item-carrito.entity.js';
import { ConfiguracionModule } from '../configuracion/configuracion.module.js';
import { NotificacionModule } from '../notificacion/notificacion.module.js';
import { EmailModule } from '../email/email.module.js';
import { TareasService } from './tareas.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Carrito, ItemCarrito]),
    ConfiguracionModule,
    NotificacionModule,
    EmailModule,
  ],
  providers: [TareasService],
})
export class TareasModule {}