import { Controller, Get, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly service: DashboardService) {}

  // Protegida — solo administradores
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('administrador')
  @Get('resumen')
  resumen() {
    return this.service.obtenerResumen();
  }
}