
import { Controller, Get, Patch, Param, Body, UseGuards } from '@nestjs/common';
import { ConfiguracionService } from './configuracion.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';

@Controller('configuracion')
export class ConfiguracionController {
  constructor(private readonly service: ConfiguracionService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('administrador')
  @Get()
  findAll() {
    return this.service.findAll();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('administrador')
  @Patch(':clave')
  actualizar(@Param('clave') clave: string, @Body('valor') valor: string) {
    return this.service.actualizar(clave, valor);
  }
}