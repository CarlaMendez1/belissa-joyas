import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, Query, UseGuards,
} from '@nestjs/common';
import { CaracteristicaService } from './caracteristica.service.js';
import { CrearCaracteristicaDto } from './dto/crear-caracteristica.dto.js';
import { ActualizarCaracteristicaDto } from './dto/actualizar-caracteristica.dto.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';

@Controller('caracteristicas')
export class CaracteristicaController {
  constructor(private readonly service: CaracteristicaService) {}

  // Pública — soporta filtrar por opción, ej. GET /caracteristicas?id_opcion=1
  @Get()
  findAll(@Query('id_opcion') id_opcion?: string) {
    if (id_opcion) return this.service.findPorOpcion(+id_opcion);
    return this.service.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findById(+id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('administrador')
  @Post()
  create(@Body() dto: CrearCaracteristicaDto) {
    return this.service.create(dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('administrador')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: ActualizarCaracteristicaDto) {
    return this.service.update(+id, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('administrador')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(+id);
  }
}