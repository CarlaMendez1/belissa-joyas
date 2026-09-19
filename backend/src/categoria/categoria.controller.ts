import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, UseGuards,
} from '@nestjs/common';
import { CategoriaService } from './categoria.service.js';
import { CrearCategoriaDto } from './dto/crear-categoria.dto.js';
import { ActualizarCategoriaDto } from './dto/actualizar-categoria.dto.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';

@Controller('categorias')
export class CategoriaController {
  constructor(private readonly service: CategoriaService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findById(+id);
  }

  @Get(':id/opciones')
  obtenerOpciones(@Param('id') id: string) {
    return this.service.obtenerOpcionesPorCategoria(+id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('administrador')
  @Post()
  create(@Body() dto: CrearCategoriaDto) {
    return this.service.create(dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('administrador')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: ActualizarCategoriaDto) {
    return this.service.update(+id, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('administrador')
  @Delete(':id')
  baja(@Param('id') id: string) {
    return this.service.bajaLogica(+id);
  }
}