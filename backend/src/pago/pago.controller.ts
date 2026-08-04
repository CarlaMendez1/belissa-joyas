import { Controller, Post, Get, Query, Body, Request, UseGuards } from '@nestjs/common';
import { PagoService } from './pago.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';

@Controller('pago')
export class PagoController {
  constructor(private readonly service: PagoService) {}

  @UseGuards(JwtAuthGuard)
  @Post('crear-preferencia')
  crearPreferencia(@Request() req: any) {
    return this.service.crearPreferencia(req.user.id_usuario);
  }

  // Sin guard: Mercado Pago llama a este endpoint directamente, sin JWT
  @Post('webhook')
  @Get('webhook')
  webhook(@Query() query: any, @Body() body: any) {
    return this.service.procesarWebhook(query, body);
  }
}