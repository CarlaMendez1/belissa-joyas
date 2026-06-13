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

  // Pública — cualquiera puede ver el catálogo (RF22)
  @Get()
  findAll() {
    return this.service.findAll();
  }

  // Pública — ver una categoría con sus subcategorías
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findById(+id);
  }

  // Protegida — solo administradores (RF5)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('administrador')
  @Post()
  create(@Body() dto: CrearCategoriaDto) {
    return this.service.create(dto);
  }

  // Protegida — solo administradores (RF6)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('administrador')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: ActualizarCategoriaDto) {
    return this.service.update(+id, dto);
  }

  // Protegida — baja lógica, solo administradores (RF7)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('administrador')
  @Delete(':id')
  baja(@Param('id') id: string) {
    return this.service.bajaLogica(+id);
  }
}