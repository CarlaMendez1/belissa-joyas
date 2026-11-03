import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LogAuditoria } from './log-auditoria.entity.js';
import { AuditoriaService } from './auditoria.service.js';
import { AuditoriaController } from './auditoria.controller.js';

@Module({
  imports: [TypeOrmModule.forFeature([LogAuditoria])],
  providers: [AuditoriaService],
  controllers: [AuditoriaController],
  exports: [AuditoriaService],
})
export class AuditoriaModule {}
