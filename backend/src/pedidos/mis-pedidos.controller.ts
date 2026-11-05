import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { PedidosService } from './pedidos.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';

// Cada cliente ve solo sus pedidos: se filtra por el usuario del token
@UseGuards(JwtAuthGuard)
@Controller('mis-pedidos')
export class MisPedidosController {
  constructor(private readonly service: PedidosService) {}

  @Get()
  listar(@Request() req: any) {
    return this.service.listarDeUsuario(req.user.id_usuario);
  }
}
