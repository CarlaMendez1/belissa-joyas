import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Opcion } from './opcion.entity.js';
import { Categoria } from '../categoria/categoria.entity.js';
import { Caracteristica } from '../caracteristica/caracteristica.entity.js';
import { CrearOpcionDto } from './dto/crear-opcion.dto.js';
import { ActualizarOpcionDto } from './dto/actualizar-opcion.dto.js';
import { normalizarTexto, traducirErrorBD } from '../common/db-errors.js';

const MENSAJES_BD = {
  uq_opcion_nombre_normalizado: 'Ya existe una opción con ese nombre',
  ck_opcion_unidad: 'Las opciones numéricas requieren unidad y las de texto no deben tenerla',
  ck_opcion_nombre_no_vacio: 'El nombre no puede estar vacío',
  trg_opcion_cambio_tipo:
    'No se puede cambiar la opción a numérica: tiene valores que no son números. Corregí o eliminá esos valores primero.',
};

@Injectable()
export class OpcionService {
  constructor(
    @InjectRepository(Opcion)
    private readonly repo: Repository<Opcion>,
    @InjectRepository(Categoria)
    private readonly categoriaRepo: Repository<Categoria>,
    @InjectRepository(Caracteristica)
    private readonly caracteristicaRepo: Repository<Caracteristica>,
  ) {}

  findAll() {
    return this.repo.find({
      order: { nombre: 'ASC' },
      relations: { categorias: true },
    });
  }

  async findById(id_opcion: number) {
    const opcion = await this.repo.findOne({
      where: { id_opcion },
      relations: { categorias: true },
    });
    if (!opcion) throw new NotFoundException('Opción no encontrada');
    return opcion;
  }

  private async resolverCategorias(idsCategorias?: number[]): Promise<Categoria[]> {
    if (!idsCategorias?.length) return [];
    return this.categoriaRepo.findBy({ id_categoria: In(idsCategorias) });
  }

  async create(dto: CrearOpcionDto) {
    const categorias = await this.resolverCategorias(dto.categorias);
    try {
      return await this.repo.save({
        nombre: normalizarTexto(dto.nombre),
        tipo_dato: dto.tipo_dato,
        unidad: dto.tipo_dato === 'numero' ? normalizarTexto(dto.unidad ?? '') : null,
        categorias,
      });
    } catch (e) {
      traducirErrorBD(e, MENSAJES_BD);
    }
  }

  async update(id_opcion: number, dto: ActualizarOpcionDto) {
    const opcion = await this.findById(id_opcion);
    if (dto.nombre !== undefined) opcion.nombre = normalizarTexto(dto.nombre);
    if (dto.tipo_dato !== undefined) opcion.tipo_dato = dto.tipo_dato;
    if (dto.unidad !== undefined) opcion.unidad = normalizarTexto(dto.unidad);
    // Al volver a texto la unidad se limpia; si es numérica debe quedar una unidad
    if (opcion.tipo_dato === 'texto') opcion.unidad = null;
    if (dto.categorias !== undefined) {
      opcion.categorias = await this.resolverCategorias(dto.categorias);
    }
    try {
      return await this.repo.save(opcion);
    } catch (e) {
      traducirErrorBD(e, MENSAJES_BD);
    }
  }

  async remove(id_opcion: number) {
    const opcion = await this.findById(id_opcion);

    // Traemos los ids de las características de esta opción.
    const caracteristicas = await this.caracteristicaRepo.find({
      where: { id_opcion },
      select: { id_caracteristica: true },
    });
    const idsCaracteristicas = caracteristicas.map((c) => c.id_caracteristica);

    if (idsCaracteristicas.length > 0) {
      // Primero limpiamos la tabla puente variante_caracteristica,
      // para no violar fk_vc_caracteristica.
      await this.repo.manager
        .createQueryBuilder()
        .delete()
        .from('variante_caracteristica')
        .where('id_caracteristica IN (:...ids)', { ids: idsCaracteristicas })
        .execute();

      // Después borramos las características de esta opción.
      await this.caracteristicaRepo.delete({ id_opcion });
    }

    await this.repo.remove(opcion);
    return { mensaje: 'Opción eliminada' };
  }
}