import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Venta } from '../venta/venta.entity.js';
import { DetalleVenta } from '../venta/detalle-venta.entity.js';
import { PedidosService } from './pedidos.service.js';
import { PedidosController } from './pedidos.controller.js';
import { AuditoriaModule } from '../auditoria/auditoria.module.js';
import { EmailModule } from '../email/email.module.js';
import { ConfiguracionModule } from '../configuracion/configuracion.module.js';
import { MisPedidosController } from './mis-pedidos.controller.js';

@Module({
  imports: [TypeOrmModule.forFeature([Venta, DetalleVenta]), AuditoriaModule, EmailModule, ConfiguracionModule],
  providers: [PedidosService],
  controllers: [PedidosController, MisPedidosController],
})
export class PedidosModule {}
