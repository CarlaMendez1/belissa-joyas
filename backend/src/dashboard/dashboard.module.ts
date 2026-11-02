import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Producto } from '../producto/producto.entity.js';
import { Categoria } from '../categoria/categoria.entity.js';
import { ClienteVip } from '../cliente-vip/cliente-vip.entity.js';
import { Venta } from '../venta/venta.entity.js';
import { LogAuditoria } from '../auditoria/log-auditoria.entity.js';
import { DashboardService } from './dashboard.service.js';
import { DashboardController } from './dashboard.controller.js';

@Module({
  imports: [TypeOrmModule.forFeature([Producto, Categoria, ClienteVip, Venta, LogAuditoria])],
  providers: [DashboardService],
  controllers: [DashboardController],
})
export class DashboardModule {}