import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Usuario } from './usuario.entity';
import { UsuarioService } from './usuario.service';
import { AdministradoresService } from './administradores.service';
import { AdministradoresController } from './administradores.controller';
import { AuditoriaModule } from '../auditoria/auditoria.module.js';

@Module({
  imports: [TypeOrmModule.forFeature([Usuario]), AuditoriaModule],
  providers: [UsuarioService, AdministradoresService],
  controllers: [AdministradoresController],
  exports: [UsuarioService],
})
export class UsuarioModule {}
