import { Controller, Post, Get, Query, Body, Request, UseGuards } from '@nestjs/common';
import { PagoService } from './pago.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { CrearPreferenciaDto } from './dto/crear-preferencia.dto.js';

@Controller('pago')
export class PagoController {
  constructor(private readonly service: PagoService) {}

  @UseGuards(JwtAuthGuard)
  @Post('crear-preferencia')
  crearPreferencia(@Request() req: any, @Body() dto: CrearPreferenciaDto) {
    return this.service.crearPreferencia(req.user.id_usuario, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('resumen')
  resumen(@Request() req: any, @Body() dto: CrearPreferenciaDto) {
    return this.service.resumenCheckout(req.user.id_usuario, dto);
  }

  // Sin guard: Mercado Pago llama a este endpoint directamente, sin JWT
  @Post('webhook')
  webhook(@Query() query: any, @Body() body: any) {
    console.log('====== WEBHOOK ENTRANTE ======');
    console.log('Query recibido:', query);
    console.log('Body recibido:', body);
    return this.service.procesarWebhook(query, body);
  }
}
