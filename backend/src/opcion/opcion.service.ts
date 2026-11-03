import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Opcion } from './opcion.entity.js';
import { Categoria } from '../categoria/categoria.entity.js';
import { Caracteristica } from '../caracteristica/caracteristica.entity.js';
import { CrearOpcionDto } from './dto/crear-opcion.dto.js';
import { ActualizarOpcionDto } from './dto/actualizar-opcion.dto.js';
import { normalizarTexto, traducirErrorBD } from '../common/db-errors.js';
import { tomar } from '../common/auditoria-utils.js';
import { AuditoriaService } from '../auditoria/auditoria.service.js';
import { AccionAuditoria } from '../auditoria/log-auditoria.entity.js';

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
    private readonly auditoriaService: AuditoriaService,
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

  // Resumen auditable de una opción (sin objetos anidados completos)
  private resumen(o: Opcion) {
    return {
      nombre: o.nombre,
      tipo_dato: o.tipo_dato,
      unidad: o.unidad,
      categorias: (o.categorias ?? []).map((c) => c.nombre).sort(),
    };
  }

  async create(dto: CrearOpcionDto, id_usuario_admin?: number) {
    const categorias = await this.resolverCategorias(dto.categorias);
    try {
      const creada = await this.repo.save({
        nombre: normalizarTexto(dto.nombre),
        tipo_dato: dto.tipo_dato,
        unidad: dto.tipo_dato === 'numero' ? normalizarTexto(dto.unidad ?? '') : null,
        categorias,
      });
      await this.auditoriaService.registrar({
        id_usuario: id_usuario_admin,
        accion: AccionAuditoria.CREAR,
        entidad: 'Opcion',
        id_entidad: creada.id_opcion,
        datos_nuevos: this.resumen(creada as Opcion),
      });
      return creada;
    } catch (e) {
      traducirErrorBD(e, MENSAJES_BD);
    }
  }

  async update(id_opcion: number, dto: ActualizarOpcionDto, id_usuario_admin?: number) {
    const opcion = await this.findById(id_opcion);
    const antes = this.resumen(opcion);
    if (dto.nombre !== undefined) opcion.nombre = normalizarTexto(dto.nombre);
    if (dto.tipo_dato !== undefined) opcion.tipo_dato = dto.tipo_dato;
    if (dto.unidad !== undefined) opcion.unidad = normalizarTexto(dto.unidad);
    // Al volver a texto la unidad se limpia; si es numérica debe quedar una unidad
    if (opcion.tipo_dato === 'texto') opcion.unidad = null;
    if (dto.categorias !== undefined) {
      opcion.categorias = await this.resolverCategorias(dto.categorias);
    }
    try {
      const guardada = await this.repo.save(opcion);
      const despues = this.resumen(guardada);
      // Solo registramos los campos que realmente cambiaron
      const cambiados = Object.keys(despues).filter(
        (k) => JSON.stringify((antes as any)[k]) !== JSON.stringify((despues as any)[k]),
      );
      if (cambiados.length > 0) {
        await this.auditoriaService.registrar({
          id_usuario: id_usuario_admin,
          accion: AccionAuditoria.EDITAR,
          entidad: 'Opcion',
          id_entidad: id_opcion,
          datos_anteriores: tomar(antes, cambiados),
          datos_nuevos: tomar(despues, cambiados),
        });
      }
      return guardada;
    } catch (e) {
      traducirErrorBD(e, MENSAJES_BD);
    }
  }

  async remove(id_opcion: number, id_usuario_admin?: number) {
    const opcion = await this.findById(id_opcion);
    const antes = this.resumen(opcion);

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
    await this.auditoriaService.registrar({
      id_usuario: id_usuario_admin,
      accion: AccionAuditoria.ELIMINAR,
      entidad: 'Opcion',
      id_entidad: id_opcion,
      datos_anteriores: { ...antes, valores_eliminados: idsCaracteristicas.length },
    });
    return { mensaje: 'Opción eliminada' };
  }
}
