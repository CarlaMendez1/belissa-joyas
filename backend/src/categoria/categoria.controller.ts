import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, UseGuards, Request, UploadedFile, UseInterceptors, BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UploadService } from '../upload/upload.service.js';
import { CategoriaService } from './categoria.service.js';
import { CrearCategoriaDto } from './dto/crear-categoria.dto.js';
import { ActualizarCategoriaDto } from './dto/actualizar-categoria.dto.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';

@Controller('categorias')
export class CategoriaController {
  constructor(
    private readonly service: CategoriaService,
    private readonly uploadService: UploadService,
  ) {}

  @Get()
  findAll() {
    return this.service.listarConPortada();
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
  create(@Body() dto: CrearCategoriaDto, @Request() req: any) {
    return this.service.create(dto, req.user.id_usuario);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('administrador')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: ActualizarCategoriaDto, @Request() req: any) {
    return this.service.update(+id, dto, req.user.id_usuario);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('administrador')
  @Post(':id/portada')
  @UseInterceptors(FileInterceptor('imagen'))
  async subirPortada(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Request() req: any,
  ) {
    if (!file) throw new BadRequestException('Falta la imagen');
    const url = await this.uploadService.subirImagen(file.buffer, 'categorias');
    return this.service.actualizarPortada(+id, url, req.user.id_usuario);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('administrador')
  @Delete(':id/portada')
  quitarPortada(@Param('id') id: string, @Request() req: any) {
    return this.service.actualizarPortada(+id, null, req.user.id_usuario);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('administrador')
  @Delete(':id')
  baja(@Param('id') id: string, @Request() req: any) {
    return this.service.bajaLogica(+id, req.user.id_usuario);
  }
}
