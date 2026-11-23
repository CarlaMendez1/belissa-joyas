import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CarruselInicio } from './carrusel.entity.js';
import { ProductoService } from '../producto/producto.service.js';
import { AuditoriaService } from '../auditoria/auditoria.service.js';
import { AccionAuditoria } from '../auditoria/log-auditoria.entity.js';

export const MAX_CARRUSEL = 7;

@Injectable()
export class CarruselService {
  constructor(
    @InjectRepository(CarruselInicio)
    private readonly repo: Repository<CarruselInicio>,
    private readonly productoService: ProductoService,
    private readonly auditoriaService: AuditoriaService,
  ) {}

  // Productos del carrusel en el orden elegido. Se omiten los que fueron dados de baja.
  async listar() {
    const filas = await this.repo.find({ order: { posicion: 'ASC' } });
    if (filas.length === 0) return [];
    const activos = await this.productoService.findAll();
    const porId = new Map(activos.map((p) => [p.id_producto, p]));
    return filas.map((f) => porId.get(f.id_producto)).filter((p) => p !== undefined);
  }

  // Reemplaza el carrusel completo por la lista recibida (el orden del arreglo es el orden final).
  async guardar(ids: number[], id_usuario_admin?: number) {
    if (ids.length > MAX_CARRUSEL) {
      throw new BadRequestException(`El carrusel admite hasta ${MAX_CARRUSEL} productos`);
    }
    if (new Set(ids).size !== ids.length) {
      throw new BadRequestException('Hay productos repetidos en la lista');
    }
    const activos = await this.productoService.findAll();
    const idsActivos = new Set(activos.map((p) => p.id_producto));
    const invalidos = ids.filter((id) => !idsActivos.has(id));
    if (invalidos.length > 0) {
      throw new BadRequestException(`Productos inexistentes o inactivos: ${invalidos.join(', ')}`);
    }

    const antes = (await this.repo.find({ order: { posicion: 'ASC' } })).map((f) => f.id_producto);

    await this.repo.manager.transaction(async (m) => {
      // delete(Entidad, {}) con criterio vacío lo rechaza TypeORM: se borra con el query builder
      await m.createQueryBuilder().delete().from(CarruselInicio).execute();
      if (ids.length > 0) {
        await m.insert(
          CarruselInicio,
          ids.map((id_producto, i) => ({ id_producto, posicion: i + 1 })),
        );
      }
    });

    await this.auditoriaService.registrar({
      id_usuario: id_usuario_admin,
      accion: AccionAuditoria.EDITAR,
      entidad: 'CarruselInicio',
      id_entidad: null,
      datos_anteriores: { productos: antes },
      datos_nuevos: { productos: ids },
    });
    return this.listar();
  }
}
