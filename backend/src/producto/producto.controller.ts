import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ProductoService } from './producto.service.js';
import { CrearProductoDto } from './dto/crear-producto.dto.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { UploadService } from '../upload/upload.service.js';

@Controller('productos')
export class ProductoController {
  constructor(
    private readonly service: ProductoService,
    private readonly uploadService: UploadService,
  ) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findById(+id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('administrador')
  @Post()
  create(@Body() dto: CrearProductoDto) {
    return this.service.create(dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('administrador')
  @Post(':id/imagen')
  @UseInterceptors(FileInterceptor('imagen'))
  async subirImagen(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const url = await this.uploadService.subirImagen(file.buffer);
    return this.service.agregarImagen(+id, url);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('administrador')
  @Delete(':id/imagen')
  async eliminarImagen(@Param('id') id: string, @Body('url') url: string) {
    return this.service.eliminarImagen(+id, url);
  }
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('administrador')
  @Patch(':id')
  update(@Param('id') id: string, @Body() body: Partial<CrearProductoDto>) {
    return this.service.update(+id, body);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('administrador')
  @Delete(':id')
  baja(@Param('id') id: string) {
    return this.service.bajaLogica(+id);
  }
}
