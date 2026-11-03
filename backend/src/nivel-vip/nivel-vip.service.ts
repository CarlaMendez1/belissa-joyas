// backend/src/nivel-vip/nivel-vip.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NivelVip } from './nivel-vip.entity.js';
import { AuditoriaService } from '../auditoria/auditoria.service.js';
import { AccionAuditoria } from '../auditoria/log-auditoria.entity.js';

@Injectable()
export class NivelVipService {
  constructor(
    @InjectRepository(NivelVip)
    private readonly repo: Repository<NivelVip>,
    private readonly auditoriaService: AuditoriaService,
  ) {}

  findAll() {
    return this.repo.find({ order: { monto_min_requerido: 'ASC' } });
  }

  async findById(id: number) {
    const nivel = await this.repo.findOneBy({ id_nivel_vip: id });
    if (!nivel) throw new NotFoundException('Nivel VIP no encontrado');
    return nivel;
  }

  async update(
    id: number,
    body: Partial<{
      monto_min_requerido: number;
      cantidad_compras_min_requerida: number;
      porcentaje_descuento: number;
      beneficios: string;
    }>,
    id_usuario_admin: number,
  ) {
    const nivel = await this.findById(id);
    const claves = Object.keys(body) as Array<keyof typeof body>;
    const antes = Object.fromEntries(claves.map((clave) => [clave, nivel[clave]]));

    Object.assign(nivel, body);
    const guardado = await this.repo.save(nivel);

    await this.auditoriaService.registrar({
      id_usuario: id_usuario_admin,
      accion: AccionAuditoria.EDITAR,
      entidad: 'NivelVip',
      id_entidad: id,
      datos_anteriores: { nombre_nivel: guardado.nombre_nivel, ...antes },
      datos_nuevos: Object.fromEntries(claves.map((k) => [k, guardado[k]])),
    });
    return guardado;
  }
}
