import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { EstadisticasService } from './estadisticas.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';

// Solo administradores. Todas las secciones aceptan ?desde=AAAA-MM-DD&hasta=AAAA-MM-DD
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('administrador')
@Controller('estadisticas')
export class EstadisticasController {
  constructor(private readonly service: EstadisticasService) {}

  @Get('ventas')
  ventas(@Query('desde') desde?: string, @Query('hasta') hasta?: string, @Query('agrupar') agrupar?: string) {
    return this.service.ventas(this.service.resolverRango(desde, hasta), this.service.resolverAgrupacion(agrupar));
  }

  @Get('productos')
  productos(@Query('desde') desde?: string, @Query('hasta') hasta?: string) {
    return this.service.productos(this.service.resolverRango(desde, hasta));
  }

  @Get('envios')
  envios(@Query('desde') desde?: string, @Query('hasta') hasta?: string) {
    return this.service.envios(this.service.resolverRango(desde, hasta));
  }

  // Paneles del módulo (cada uno incluye la comparación con el período anterior)
  @Get('panel/ventas')
  panelVentas(@Query('desde') desde?: string, @Query('hasta') hasta?: string) {
    return this.service.panelVentas(this.service.resolverRango(desde, hasta));
  }

  @Get('panel/productos')
  panelProductos(@Query('desde') desde?: string, @Query('hasta') hasta?: string) {
    return this.service.panelProductos(this.service.resolverRango(desde, hasta));
  }

  @Get('panel/clientes')
  panelClientes(@Query('desde') desde?: string, @Query('hasta') hasta?: string) {
    return this.service.panelClientes(this.service.resolverRango(desde, hasta));
  }

  @Get('panel/rescate')
  panelRescate(@Query('desde') desde?: string, @Query('hasta') hasta?: string) {
    return this.service.panelRescate(this.service.resolverRango(desde, hasta));
  }
}
