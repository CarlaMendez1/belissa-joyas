import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Variante, EstadoVariante } from './variante.entity.js';
import { Caracteristica } from '../caracteristica/caracteristica.entity.js';
import { CrearVarianteDto } from './dto/crear-variante.dto.js';
import { AuditoriaService } from '../auditoria/auditoria.service.js';
import { AccionAuditoria } from '../auditoria/log-auditoria.entity.js';

@Injectable()
export class VarianteService {
  constructor(
    @InjectRepository(Variante)
    private readonly repo: Repository<Variante>,
    @InjectRepository(Caracteristica)
    private readonly caracRepo: Repository<Caracteristica>,
    private readonly auditoriaService: AuditoriaService,
  ) {}

  findByProducto(id_producto: number): Promise<Variante[]> {
    return this.repo.find({
      where: { id_producto, estado: EstadoVariante.ACTIVA },
      relations: { caracteristicas: true },
    });
  }

  private async validarCaracteristicasPorCategoria(
    id_producto: number,
    idsCaracteristicas: number[],
  ): Promise<void> {
    if (!idsCaracteristicas.length) return;

    const resultado = await this.repo.manager
      .createQueryBuilder()
      .select('caracteristica.id_caracteristica', 'id_caracteristica')
      .from('caracteristica', 'caracteristica')
      .innerJoin('opcion', 'opcion', 'opcion.id_opcion = caracteristica.id_opcion')
      .innerJoin('categoria_opcion', 'co', 'co.id_opcion = opcion.id_opcion')
      .innerJoin('producto', 'producto', 'producto.id_producto = :id_producto', { id_producto })
      .innerJoin(
        'subcategoria',
        'sub',
        'sub.id_subcategoria = producto.id_subcategoria AND sub.id_categoria = co.id_categoria',
      )
      .where('caracteristica.id_caracteristica IN (:...ids)', { ids: idsCaracteristicas })
      .getRawMany();

    const idsValidos = new Set(resultado.map((r) => Number(r.id_caracteristica)));
    const invalidas = idsCaracteristicas.filter((id) => !idsValidos.has(id));

    if (invalidas.length > 0) {
      throw new BadRequestException(
        `Las características [${invalidas.join(', ')}] no corresponden a opciones habilitadas para la categoría de este producto`,
      );
    }
  }

  async create(dto: CrearVarianteDto, id_usuario_admin: number): Promise<Variante> {
    if (dto.caracteristicas?.length) {
      await this.validarCaracteristicasPorCategoria(dto.id_producto, dto.caracteristicas);
    }
    const sku = `VAR-${Date.now()}`;
    const caracteristicas = dto.caracteristicas?.length
      ? await this.caracRepo.findBy({ id_caracteristica: In(dto.caracteristicas) })
      : [];
    const variante = await this.repo.save({
      id_producto:      dto.id_producto,
      codigo_sku:       sku,
      precio_venta:     dto.precio_venta,
      stock_disponible: dto.stock_disponible ?? 0,
      caracteristicas,
    });

    await this.auditoriaService.registrar({
      id_usuario: id_usuario_admin,
      accion: AccionAuditoria.CREAR,
      entidad: 'Variante',
      id_entidad: variante.id_variante,
      datos_nuevos: {
        codigo_sku: variante.codigo_sku,
        precio_venta: variante.precio_venta,
        stock_disponible: variante.stock_disponible,
      },
    });

    return variante;
  }

  async actualizarStock(id: number, cantidad: number, id_usuario_admin: number): Promise<Variante> {
    const varianteAntes = await this.repo.findOneBy({ id_variante: id });
    if (!varianteAntes) throw new NotFoundException(`Variante ${id} no encontrada`);

    await this.repo.update(id, { stock_disponible: cantidad });
    const variante = await this.repo.findOneBy({ id_variante: id });
    if (!variante) throw new NotFoundException(`Variante ${id} no encontrada`);

    await this.auditoriaService.registrar({
      id_usuario: id_usuario_admin,
      accion: AccionAuditoria.EDITAR,
      entidad: 'Variante',
      id_entidad: id,
      datos_anteriores: { stock_disponible: varianteAntes.stock_disponible },
      datos_nuevos: { stock_disponible: cantidad },
    });

    return variante;
  }

  async update(id: number, dto: Partial<CrearVarianteDto>, id_usuario_admin: number): Promise<Variante> {
    const variante = await this.repo.findOneBy({ id_variante: id });
    if (!variante) throw new NotFoundException(`Variante ${id} no encontrada`);

    const datosAnteriores = {
      precio_venta: variante.precio_venta,
      stock_disponible: variante.stock_disponible,
    };

    if (dto.precio_venta !== undefined) variante.precio_venta = dto.precio_venta;
    if (dto.stock_disponible !== undefined) variante.stock_disponible = dto.stock_disponible;
    if (dto.caracteristicas !== undefined) {
      if (dto.caracteristicas.length) {
        await this.validarCaracteristicasPorCategoria(variante.id_producto, dto.caracteristicas);
      }
      variante.caracteristicas = dto.caracteristicas.length
        ? await this.caracRepo.findBy({ id_caracteristica: In(dto.caracteristicas) })
        : [];
    }

    const guardada = await this.repo.save(variante);

    await this.auditoriaService.registrar({
      id_usuario: id_usuario_admin,
      accion: AccionAuditoria.EDITAR,
      entidad: 'Variante',
      id_entidad: id,
      datos_anteriores: datosAnteriores,
      datos_nuevos: {
        precio_venta: guardada.precio_venta,
        stock_disponible: guardada.stock_disponible,
      },
    });

    return guardada;
  }

  async agregarImagen(id: number, url: string): Promise<Variante> {
    const variante = await this.repo.findOneBy({ id_variante: id });
    if (!variante) throw new NotFoundException(`Variante ${id} no encontrada`);
    const imagenesActuales = variante.imagenes || [];
    variante.imagenes = [...imagenesActuales, url];
    return this.repo.save(variante);
  }

  async bajaLogica(id: number, id_usuario_admin: number): Promise<Variante> {
    await this.repo.update(id, { estado: EstadoVariante.INACTIVA });
    const variante = await this.repo.findOneBy({ id_variante: id });
    if (!variante) throw new NotFoundException(`Variante ${id} no encontrada`);

    await this.auditoriaService.registrar({
      id_usuario: id_usuario_admin,
      accion: AccionAuditoria.ELIMINAR,
      entidad: 'Variante',
      id_entidad: id,
      datos_anteriores: { estado: 'activa' },
      datos_nuevos: { estado: 'inactiva' },
    });

    return variante;
  }
}