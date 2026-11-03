import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Configuracion } from './configuracion.entity.js';
import { ConfiguracionService } from './configuracion.service.js';
import { ConfiguracionController } from './configuracion.controller.js';
import { AuditoriaModule } from '../auditoria/auditoria.module.js';

@Module({
  imports: [TypeOrmModule.forFeature([Configuracion]), AuditoriaModule],
  providers: [ConfiguracionService],
  controllers: [ConfiguracionController],
  exports: [ConfiguracionService],
})
export class ConfiguracionModule {}
