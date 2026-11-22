import { Body, Controller, Get, Put, Request, UseGuards } from '@nestjs/common';
import { CarruselService } from './carrusel.service.js';
import { GuardarCarruselDto } from './dto/guardar-carrusel.dto.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';

@Controller('carrusel')
export class CarruselController {
  constructor(private readonly service: CarruselService) {}

  // Público: lo usa la página de inicio.
  @Get()
  listar() {
    return this.service.listar();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('administrador')
  @Put()
  guardar(@Body() dto: GuardarCarruselDto, @Request() req: any) {
    return this.service.guardar(dto.ids_producto, req.user.id_usuario);
  }
}
