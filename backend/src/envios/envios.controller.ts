import { Controller, Get, Patch, Param, Body, UseGuards, Request } from '@nestjs/common';
import { EnviosService } from './envios.service.js';
import { ActualizarTarifaDto } from './dto/actualizar-tarifa.dto.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';

@Controller('envios')
export class EnviosController {
  constructor(private readonly service: EnviosService) {}

  // Públicas: el formulario de dirección y el checkout las necesitan
  @Get('provincias')
  provincias() {
    return this.service.listarProvincias();
  }

  @Get('opciones')
  opciones() {
    return this.service.opcionesEntrega();
  }

  // Administración
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('administrador')
  @Get('tarifas')
  tarifas() {
    return this.service.listarTarifas();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('administrador')
  @Patch('tarifas/:id')
  actualizarTarifa(@Param('id') id: string, @Body() dto: ActualizarTarifaDto, @Request() req: any) {
    return this.service.actualizarTarifa(+id, dto, req.user.id_usuario);
  }
}
