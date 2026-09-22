import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { VarianteService } from './variante.service.js';
import { CrearVarianteDto } from './dto/crear-variante.dto.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { UploadService } from '../upload/upload.service.js';

@Controller('variantes')
export class VarianteController {
  constructor(
    private readonly service: VarianteService,
    private readonly uploadService: UploadService,
  ) {}

  @Get('producto/:id')
  findByProducto(@Param('id') id: string) {
    return this.service.findByProducto(+id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('administrador')
  @Post()
  create(@Body() dto: CrearVarianteDto) {
    return this.service.create(dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('administrador')
  @Post(':id/imagen')
  @UseInterceptors(FileInterceptor('imagen'))
  async agregarImagen(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const url = await this.uploadService.subirImagen(file.buffer);
    return this.service.agregarImagen(+id, url);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('administrador')
  @Patch(':id/stock')
  actualizarStock(@Param('id') id: string, @Body('cantidad') cantidad: number) {
    return this.service.actualizarStock(+id, cantidad);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('administrador')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: Partial<CrearVarianteDto>) {
    return this.service.update(+id, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('administrador')
  @Delete(':id')
  baja(@Param('id') id: string) {
    return this.service.bajaLogica(+id);
  }
}