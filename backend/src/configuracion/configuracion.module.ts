
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Configuracion } from './configuracion.entity.js';
import { ConfiguracionService } from './configuracion.service.js';
import { ConfiguracionController } from './configuracion.controller.js';

@Module({
  imports: [TypeOrmModule.forFeature([Configuracion])],
  providers: [ConfiguracionService],
  controllers: [ConfiguracionController],
  exports: [ConfiguracionService],
})
export class ConfiguracionModule {}