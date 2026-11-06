import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Req, UseGuards } from '@nestjs/common';
import { AdministradoresService } from './administradores.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';

// Solo un administrador puede ver, agregar o quitar administradores
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('administrador')
@Controller('administradores')
export class AdministradoresController {
  constructor(private readonly service: AdministradoresService) {}

  @Get()
  listar(@Req() req: { user: { id_usuario: number } }) {
    return this.service.listar(req.user.id_usuario);
  }

  @Post()
  promover(@Body('email') email: string, @Req() req: { user: { id_usuario: number } }) {
    return this.service.promover(email, req.user.id_usuario);
  }

  @Delete(':id')
  quitar(@Param('id', ParseIntPipe) id: number, @Req() req: { user: { id_usuario: number } }) {
    return this.service.quitar(id, req.user.id_usuario);
  }
}
