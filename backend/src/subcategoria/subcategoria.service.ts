import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Subcategoria } from './subcategoria.entity.js';
import { EstadoGeneral } from '../categoria/categoria.entity.js';
import { AuditoriaService } from '../auditoria/auditoria.service.js';
import { AccionAuditoria } from '../auditoria/log-auditoria.entity.js';
import { tomar } from '../common/auditoria-utils.js';

@Injectable()
export class SubcategoriaService {
  constructor(
    @InjectRepository(Subcategoria)
    private readonly repo: Repository<Subcategoria>,
    private readonly auditoriaService: AuditoriaService,
  ) {}

  findAll(): Promise<Subcategoria[]> {
    return this.repo.find({ where: { estado: EstadoGeneral.ACTIVA } });
  }

  findByCategoria(id_categoria: number): Promise<Subcategoria[]> {
    return this.repo.find({ where: { id_categoria, estado: EstadoGeneral.ACTIVA } });
  }

  async create(data: Partial<Subcategoria>, id_usuario_admin?: number): Promise<Subcategoria> {
    const subcategoria = await this.repo.save(data);
    await this.auditoriaService.registrar({
      id_usuario: id_usuario_admin,
      accion: AccionAuditoria.CREAR,
      entidad: 'Subcategoria',
      id_entidad: subcategoria.id_subcategoria,
      datos_nuevos: {
        nombre: subcategoria.nombre,
        descripcion: subcategoria.descripcion,
        id_categoria: subcategoria.id_categoria,
      },
    });
    return subcategoria;
  }

  async update(id: number, data: Partial<Subcategoria>, id_usuario_admin?: number): Promise<Subcategoria | null> {
    const antes = await this.repo.findOneBy({ id_subcategoria: id });
    await this.repo.update(id, data);
    const despues = await this.repo.findOneBy({ id_subcategoria: id });

    if (antes && despues) {
      const claves = Object.keys(data);
      await this.auditoriaService.registrar({
        id_usuario: id_usuario_admin,
        accion: AccionAuditoria.EDITAR,
        entidad: 'Subcategoria',
        id_entidad: id,
        datos_anteriores: tomar(antes, claves),
        datos_nuevos: tomar(despues, claves),
      });
    }
    return despues;
  }

  // Baja lógica — RF11
  async bajaLogica(id: number, id_usuario_admin?: number): Promise<Subcategoria | null> {
    const antes = await this.repo.findOneBy({ id_subcategoria: id });
    await this.repo.update(id, { estado: EstadoGeneral.INACTIVA });

    if (antes) {
      await this.auditoriaService.registrar({
        id_usuario: id_usuario_admin,
        accion: AccionAuditoria.ELIMINAR,
        entidad: 'Subcategoria',
        id_entidad: id,
        datos_anteriores: { nombre: antes.nombre, estado: antes.estado },
        datos_nuevos: { estado: EstadoGeneral.INACTIVA },
      });
    }
    return this.repo.findOneBy({ id_subcategoria: id });
  }
}
