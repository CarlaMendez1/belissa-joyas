import { Controller, Get, Patch, Param, Query, Body, UseGuards, Request, ParseIntPipe } from '@nestjs/common';
import { PedidosService } from './pedidos.service.js';
import { CambiarEstadoEnvioDto } from './dto/cambiar-estado-envio.dto.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('administrador')
@Controller('pedidos')
export class PedidosController {
  constructor(private readonly service: PedidosService) {}

  @Get()
  listar(
    @Query('estado_envio') estado_envio?: string,
    @Query('tipo_entrega') tipo_entrega?: string,
    @Query('pagina') pagina?: string,
    @Query('limite') limite?: string,
  ) {
    return this.service.listar({
      estado_envio: estado_envio || undefined,
      tipo_entrega: tipo_entrega || undefined,
      pagina: pagina ? Number(pagina) : undefined,
      limite: limite ? Number(limite) : undefined,
    });
  }

  @Get(':id')
  obtener(@Param('id', ParseIntPipe) id: number) {
    return this.service.obtener(id);
  }

  @Patch(':id/estado')
  cambiarEstado(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CambiarEstadoEnvioDto,
    @Request() req: any,
  ) {
    return this.service.cambiarEstado(id, dto, req.user.id_usuario);
  }
}
