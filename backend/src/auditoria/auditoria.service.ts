import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere, Between, MoreThanOrEqual, LessThanOrEqual } from 'typeorm';
import { LogAuditoria, AccionAuditoria } from './log-auditoria.entity.js';

export interface FiltrosAuditoria {
  entidad?: string;
  accion?: AccionAuditoria;
  id_usuario?: number;
  desde?: Date;
  hasta?: Date;
  pagina?: number;
  limite?: number;
}

const LIMITE_MAXIMO = 100;

@Injectable()
export class AuditoriaService {
  constructor(
    @InjectRepository(LogAuditoria)
    private readonly repo: Repository<LogAuditoria>,
  ) {}

  async registrar(datos: {
    id_usuario: number | null | undefined;
    accion: AccionAuditoria;
    entidad: string;
    id_entidad: number | null;
    datos_anteriores?: any;
    datos_nuevos?: any;
  }) {
    return this.repo.save(datos as any);
  }

  // Historial paginado para la pantalla de administración.
  // Devuelve solo el nombre del usuario: la entidad Usuario incluye password_hash.
  async listar(filtros: FiltrosAuditoria = {}) {
    const limite = Math.min(Math.max(filtros.limite ?? 20, 1), LIMITE_MAXIMO);
    const pagina = Math.max(filtros.pagina ?? 1, 1);

    const where: FindOptionsWhere<LogAuditoria> = {};
    if (filtros.entidad) where.entidad = filtros.entidad;
    if (filtros.accion) where.accion = filtros.accion;
    if (filtros.id_usuario) where.id_usuario = filtros.id_usuario;
    if (filtros.desde && filtros.hasta) where.fecha = Between(filtros.desde, filtros.hasta);
    else if (filtros.desde) where.fecha = MoreThanOrEqual(filtros.desde);
    else if (filtros.hasta) where.fecha = LessThanOrEqual(filtros.hasta);

    const [logs, total] = await this.repo.findAndCount({
      where,
      relations: { usuario: true },
      order: { fecha: 'DESC', id_log: 'DESC' },
      skip: (pagina - 1) * limite,
      take: limite,
    });

    return {
      items: logs.map((l) => ({
        id_log: l.id_log,
        accion: l.accion,
        entidad: l.entidad,
        id_entidad: l.id_entidad,
        datos_anteriores: l.datos_anteriores,
        datos_nuevos: l.datos_nuevos,
        fecha: l.fecha,
        usuario: l.usuario ? `${l.usuario.nombre} ${l.usuario.apellido}`.trim() : null,
      })),
      total,
      pagina,
      limite,
    };
  }

  // Entidades que ya tienen registros, para armar el filtro de la pantalla.
  async entidades(): Promise<string[]> {
    const filas = await this.repo
      .createQueryBuilder('l')
      .select('DISTINCT l.entidad', 'entidad')
      .orderBy('l.entidad', 'ASC')
      .getRawMany<{ entidad: string }>();
    return filas.map((f) => f.entidad);
  }
}