import { BadRequestException, Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuditoriaService } from './auditoria.service.js';
import { AccionAuditoria } from './log-auditoria.entity.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';

function aFecha(valor: string | undefined, finDelDia: boolean): Date | undefined {
  if (!valor) return undefined;
  // Acepta YYYY-MM-DD; "hasta" incluye todo ese día.
  const fecha = new Date(`${valor}T${finDelDia ? '23:59:59.999' : '00:00:00.000'}`);
  if (Number.isNaN(fecha.getTime())) throw new BadRequestException(`Fecha inválida: ${valor}`);
  return fecha;
}

function aEntero(valor: string | undefined, nombre: string): number | undefined {
  if (valor === undefined || valor === '') return undefined;
  const n = Number(valor);
  if (!Number.isInteger(n) || n < 1) throw new BadRequestException(`"${nombre}" debe ser un número entero positivo`);
  return n;
}

// Protegido — solo administradores
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('administrador')
@Controller('auditoria')
export class AuditoriaController {
  constructor(private readonly service: AuditoriaService) {}

  @Get()
  listar(
    @Query('entidad') entidad?: string,
    @Query('accion') accion?: string,
    @Query('id_usuario') id_usuario?: string,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
    @Query('pagina') pagina?: string,
    @Query('limite') limite?: string,
  ) {
    if (
      accion &&
      !Object.values(AccionAuditoria).includes(accion as AccionAuditoria)
    ) {
      throw new BadRequestException(
        'La acción debe ser crear, editar o eliminar',
      );
    }
    return this.service.listar({
      entidad: entidad || undefined,
      accion: (accion as AccionAuditoria) || undefined,
      id_usuario: aEntero(id_usuario, 'id_usuario'),
      desde: aFecha(desde, false),
      hasta: aFecha(hasta, true),
      pagina: aEntero(pagina, 'pagina'),
      limite: aEntero(limite, 'limite'),
    });
  }

  @Get('entidades')
  entidades() {
    return this.service.entidades();
  }
}
