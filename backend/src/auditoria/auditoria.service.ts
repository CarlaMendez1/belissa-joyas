import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LogAuditoria, AccionAuditoria } from './log-auditoria.entity.js';

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
    id_entidad: number;
    datos_anteriores?: any;
    datos_nuevos?: any;
  }) {
    return this.repo.save(datos as any);
  }

  // Para uso futuro: listar el historial, útil para una pantalla de admin.
  async listar(filtros?: { entidad?: string; id_entidad?: number }) {
    return this.repo.find({
      where: filtros,
      relations: { usuario: true },
      order: { fecha: 'DESC' },
      take: 100,
    });
  }
}
