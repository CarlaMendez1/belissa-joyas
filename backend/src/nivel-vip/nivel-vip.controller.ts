
import { Controller, Get, Patch, Param, Body, UseGuards } from '@nestjs/common';
import { NivelVipService } from './nivel-vip.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';

@Controller('niveles-vip')
export class NivelVipController {
  constructor(private readonly service: NivelVipService) {}

  // Pública — puede ser útil para mostrar los beneficios en el sitio
  @Get()
  findAll() {
    return this.service.findAll();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('administrador')
  @Patch(':id')
  update(@Param('id') id: string, @Body() body: Partial<{
    monto_min_requerido: number;
    cantidad_compras_min_requerida: number;
    porcentaje_descuento: number;
    beneficios: string;
  }>) {
    return this.service.update(+id, body);
  }
}