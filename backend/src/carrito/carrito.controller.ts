import { Controller, Get, Post, Delete, Body, Param, UseGuards, Request } from '@nestjs/common';
import { CarritoService } from './carrito.service.js';
import { AgregarItemDto } from './dto/agregar-item.dto.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';

@UseGuards(JwtAuthGuard)
@Controller('carrito')
export class CarritoController {
  constructor(private readonly service: CarritoService) {}

  @Get()
  obtener(@Request() req: any) {
    return this.service.obtenerCarrito(req.user.id_usuario);
  }

  @Post('item')
  agregar(@Request() req: any, @Body() dto: AgregarItemDto) {
    return this.service.agregarItem(req.user.id_usuario, dto);
  }

  @Delete('item/:id_variante')
  eliminar(@Request() req: any, @Param('id_variante') id: string) {
    return this.service.eliminarItem(req.user.id_usuario, +id);
  }

  @Delete('vaciar')
  vaciar(@Request() req: any) {
    return this.service.vaciarCarrito(req.user.id_usuario);
  }
}