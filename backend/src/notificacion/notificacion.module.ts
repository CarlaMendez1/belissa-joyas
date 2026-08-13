// backend/src/notificacion/notificacion.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Notificacion } from './notificacion.entity.js';
import { NotificacionService } from './notificacion.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Notificacion])],
  providers: [NotificacionService],
  exports: [NotificacionService],
})
export class NotificacionModule {}