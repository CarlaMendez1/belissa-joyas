import { Controller, Get, Post, Patch, Param, Body, UseGuards, Request } from '@nestjs/common';
import { EnviosService } from './envios.service.js';
import { CrearDireccionDto } from './dto/crear-direccion.dto.js';
import { ActualizarDireccionDto } from './dto/actualizar-direccion.dto.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';

// Cada cliente solo accede a sus propias direcciones (se filtra por el usuario del token)
@UseGuards(JwtAuthGuard)
@Controller('direcciones')
export class DireccionesController {
  constructor(private readonly service: EnviosService) {}

  @Get()
  listar(@Request() req: any) {
    return this.service.listarDirecciones(req.user.id_usuario);
  }

  @Post()
  crear(@Body() dto: CrearDireccionDto, @Request() req: any) {
    return this.service.crearDireccion(req.user.id_usuario, dto);
  }

  @Patch(':id')
  actualizar(@Param('id') id: string, @Body() dto: ActualizarDireccionDto, @Request() req: any) {
    return this.service.actualizarDireccion(req.user.id_usuario, +id, dto);
  }
}
