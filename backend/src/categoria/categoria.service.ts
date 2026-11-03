import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Categoria, EstadoGeneral } from './categoria.entity.js';
import { Opcion } from '../opcion/opcion.entity.js';
import { AuditoriaService } from '../auditoria/auditoria.service.js';
import { AccionAuditoria } from '../auditoria/log-auditoria.entity.js';
import { tomar } from '../common/auditoria-utils.js';

@Injectable()
export class CategoriaService {
  constructor(
    @InjectRepository(Categoria)
    private readonly repo: Repository<Categoria>,
    @InjectRepository(Opcion)
    private readonly opcionRepo: Repository<Opcion>,
    private readonly auditoriaService: AuditoriaService,
  ) {}

  findAll(): Promise<Categoria[]> {
    return this.repo.find({ where: { estado: EstadoGeneral.ACTIVA } });
  }

  async findById(id: number): Promise<Categoria> {
    const categoria = await this.repo.findOne({
      where: { id_categoria: id },
    });
    if (!categoria) {
      throw new NotFoundException(`Categoría con id ${id} no encontrada`);
    }
    return categoria;
  }

  async create(data: Partial<Categoria>, id_usuario_admin?: number): Promise<Categoria> {
    const categoria = await this.repo.save(data);
    await this.auditoriaService.registrar({
      id_usuario: id_usuario_admin,
      accion: AccionAuditoria.CREAR,
      entidad: 'Categoria',
      id_entidad: categoria.id_categoria,
      datos_nuevos: { nombre: categoria.nombre, descripcion: categoria.descripcion },
    });
    return categoria;
  }

  async update(id: number, data: Partial<Categoria>, id_usuario_admin?: number): Promise<Categoria> {
    const antes = await this.findById(id);
    await this.repo.update(id, data);
    const despues = await this.findById(id);
    const claves = Object.keys(data);
    await this.auditoriaService.registrar({
      id_usuario: id_usuario_admin,
      accion: AccionAuditoria.EDITAR,
      entidad: 'Categoria',
      id_entidad: id,
      datos_anteriores: tomar(antes, claves),
      datos_nuevos: tomar(despues, claves),
    });
    return despues;
  }

  async bajaLogica(id: number, id_usuario_admin?: number): Promise<Categoria> {
    const antes = await this.findById(id);
    await this.repo.update(id, { estado: EstadoGeneral.INACTIVA });
    await this.auditoriaService.registrar({
      id_usuario: id_usuario_admin,
      accion: AccionAuditoria.ELIMINAR,
      entidad: 'Categoria',
      id_entidad: id,
      datos_anteriores: { nombre: antes.nombre, estado: antes.estado },
      datos_nuevos: { estado: EstadoGeneral.INACTIVA },
    });
    return this.findById(id);
  }

  // Nuevo: devuelve las opciones habilitadas para una categoría,
  // usando la tabla intermedia categoria_opcion.
  async obtenerOpcionesPorCategoria(id_categoria: number): Promise<Opcion[]> {
    await this.findById(id_categoria); // valida que la categoría exista

    return this.opcionRepo
      .createQueryBuilder('opcion')
      .innerJoin('opcion.categorias', 'categoria', 'categoria.id_categoria = :id_categoria', { id_categoria })
      .getMany();
  }
}
