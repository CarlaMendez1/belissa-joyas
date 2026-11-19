import { Controller, Get, Post, Delete, Param, ParseIntPipe, UseGuards, Request } from '@nestjs/common';
import { FavoritoService } from './favorito.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';

@UseGuards(JwtAuthGuard)
@Controller('favoritos')
export class FavoritoController {
  constructor(private readonly service: FavoritoService) {}

  @Get()
  listar(@Request() req: any) {
    return this.service.listar(req.user.id_usuario);
  }

  @Get('ids')
  ids(@Request() req: any) {
    return this.service.ids(req.user.id_usuario);
  }

  @Post(':id_producto')
  agregar(@Request() req: any, @Param('id_producto', ParseIntPipe) id: number) {
    return this.service.agregar(req.user.id_usuario, id);
  }

  @Delete(':id_producto')
  quitar(@Request() req: any, @Param('id_producto', ParseIntPipe) id: number) {
    return this.service.quitar(req.user.id_usuario, id);
  }
}
