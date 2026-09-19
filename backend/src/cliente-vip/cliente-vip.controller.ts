
import { Controller, Get, Request, UseGuards } from '@nestjs/common';
import { ClienteVipService } from './cliente-vip.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';

@Controller('cliente-vip')
export class ClienteVipController {
  constructor(private readonly service: ClienteVipService) {}

  // El propio usuario logueado consulta su nivel actual
  @UseGuards(JwtAuthGuard)
  @Get('mi-nivel')
  async miNivel(@Request() req: any) {
    const cliente = await this.service.obtenerPorUsuario(req.user.id_usuario);
    return cliente || { mensaje: 'Todavía no tenés nivel VIP asignado' };
  }
}