import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { VarianteService } from './variante.service.js';
import { CrearVarianteDto } from './dto/crear-variante.dto.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';

@Controller('variantes')
export class VarianteController {
  constructor(private readonly service: VarianteService) {}

  @Get('producto/:id')
  findByProducto(@Param('id') id: string) {
    return this.service.findByProducto(+id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('administrador')
  @Post()
  create(@Body() dto: CrearVarianteDto) { return this.service.create(dto); }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('administrador')
  @Patch(':id/stock')
  actualizarStock(@Param('id') id: string, @Body('cantidad') cantidad: number) {
    return this.service.actualizarStock(+id, cantidad);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('administrador')
  @Delete(':id')
  baja(@Param('id') id: string) { return this.service.bajaLogica(+id); }
}