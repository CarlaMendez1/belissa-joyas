
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClienteVip } from './cliente-vip.entity.js';
import { NivelVip } from '../nivel-vip/nivel-vip.entity.js';
import { Venta } from '../venta/venta.entity.js';
import { Usuario } from '../usuario/usuario.entity.js';
import { NotificacionModule } from '../notificacion/notificacion.module.js';
import { EmailModule } from '../email/email.module.js';
import { ClienteVipService } from './cliente-vip.service.js';
import { ClienteVipController } from './cliente-vip.controller.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([ClienteVip, NivelVip, Venta, Usuario]),
    NotificacionModule,
    EmailModule,
  ],
  providers: [ClienteVipService],
  controllers: [ClienteVipController],
  exports: [ClienteVipService],
})
export class ClienteVipModule {}