import { Controller, Get, Post, Patch, Delete, Param, Body } from '@nestjs/common';
import { SubcategoriaService } from './subcategoria.service.js';

@Controller('subcategorias')
export class SubcategoriaController {
  constructor(private readonly service: SubcategoriaService) {}

  @Get()
  findAll() { return this.service.findAll(); }

  @Get('categoria/:id')
  findByCategoria(@Param('id') id: string) {
    return this.service.findByCategoria(+id);
  }

  @Post()
  create(@Body() body: any) { return this.service.create(body); }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: any) {
    return this.service.update(+id, body);
  }

  @Delete(':id')
  baja(@Param('id') id: string) { return this.service.bajaLogica(+id); }
}