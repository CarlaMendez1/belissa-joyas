import { Controller, Get, Request, UseGuards } from '@nestjs/common';
import { ClienteVipService } from './cliente-vip.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';

@Controller('cliente-vip')
export class ClienteVipController {
  constructor(private readonly service: ClienteVipService) {}

  // El propio usuario logueado consulta su nivel y progreso actual
  @UseGuards(JwtAuthGuard)
  @Get('mi-nivel')
  async miNivel(@Request() req: any) {
    return this.service.obtenerProgreso(req.user.id_usuario);
  }
}
