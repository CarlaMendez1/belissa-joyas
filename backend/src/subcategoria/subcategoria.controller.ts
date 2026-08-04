import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { SubcategoriaService } from './subcategoria.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';

@Controller('subcategorias')
export class SubcategoriaController {
  constructor(private readonly service: SubcategoriaService) {}

  @Get()
  findAll() { return this.service.findAll(); }

  @Get('categoria/:id')
  findByCategoria(@Param('id') id: string) {
    return this.service.findByCategoria(+id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('administrador')
  @Post()
  create(@Body() body: any) { return this.service.create(body); }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('administrador')
  @Patch(':id')
  update(@Param('id') id: string, @Body() body: any) {
    return this.service.update(+id, body);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('administrador')
  @Delete(':id')
  baja(@Param('id') id: string) { return this.service.bajaLogica(+id); }
}