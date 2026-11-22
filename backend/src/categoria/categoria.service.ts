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

  // Categorías activas para la tienda. `imagen` es la portada elegida por la administradora
  // o, si no cargó ninguna, la primera foto de un producto activo de esa categoría.
  async listarConPortada() {
    const categorias = await this.findAll();
    const filas: { id_categoria: number; imagen: string }[] = await this.repo.manager.query(
      `SELECT DISTINCT ON (s.id_categoria) s.id_categoria, p.imagenes->>0 AS imagen
         FROM producto p
         JOIN subcategoria s ON s.id_subcategoria = p.id_subcategoria
        WHERE p.estado = 'activa'
          AND jsonb_typeof(p.imagenes) = 'array'
          AND jsonb_array_length(p.imagenes) > 0
        ORDER BY s.id_categoria, p.id_producto`,
    );
    const porCategoria = new Map(filas.map((f) => [Number(f.id_categoria), f.imagen]));
    return categorias.map((c) => ({
      ...c,
      imagen: c.imagen_portada || porCategoria.get(c.id_categoria) || null,
    }));
  }

  // Guarda (o quita, con null) la foto de portada de la categoría.
  async actualizarPortada(id: number, url: string | null, id_usuario_admin?: number): Promise<Categoria> {
    const antes = await this.findById(id);
    await this.repo.update(id, { imagen_portada: url });
    await this.auditoriaService.registrar({
      id_usuario: id_usuario_admin,
      accion: AccionAuditoria.EDITAR,
      entidad: 'Categoria',
      id_entidad: id,
      datos_anteriores: { imagen_portada: antes.imagen_portada },
      datos_nuevos: { imagen_portada: url },
    });
    return this.findById(id);
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
