import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Variante, EstadoVariante } from './variante.entity.js';
import { Caracteristica } from '../caracteristica/caracteristica.entity.js';
import { CrearVarianteDto } from './dto/crear-variante.dto.js';

@Injectable()
export class VarianteService {
  constructor(
    @InjectRepository(Variante)
    private readonly repo: Repository<Variante>,
    @InjectRepository(Caracteristica)
    private readonly caracRepo: Repository<Caracteristica>,
  ) {}

  findByProducto(id_producto: number): Promise<Variante[]> {
    return this.repo.find({
      where: { id_producto, estado: EstadoVariante.ACTIVA },
      relations: { caracteristicas: true },
    });
  }

  // Nuevo: valida que las características elegidas correspondan a opciones
  // habilitadas para la categoría del producto (catálogo dinámico).
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

  async create(dto: CrearVarianteDto): Promise<Variante> {
    if (dto.caracteristicas?.length) {
      await this.validarCaracteristicasPorCategoria(dto.id_producto, dto.caracteristicas);
    }
    const sku = `VAR-${Date.now()}`;
    const caracteristicas = dto.caracteristicas?.length
      ? await this.caracRepo.findBy({ id_caracteristica: In(dto.caracteristicas) })
      : [];
    return this.repo.save({
      id_producto:      dto.id_producto,
      codigo_sku:       sku,
      precio_venta:     dto.precio_venta,
      stock_disponible: dto.stock_disponible ?? 0,
      caracteristicas,
    });
  }

  async actualizarStock(id: number, cantidad: number): Promise<Variante> {
    await this.repo.update(id, { stock_disponible: cantidad });
    const variante = await this.repo.findOneBy({ id_variante: id });
    if (!variante) throw new NotFoundException(`Variante ${id} no encontrada`);
    return variante;
  }

  async update(id: number, dto: Partial<CrearVarianteDto>): Promise<Variante> {
    const variante = await this.repo.findOneBy({ id_variante: id });
    if (!variante) throw new NotFoundException(`Variante ${id} no encontrada`);
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
    return this.repo.save(variante);
  }

  async agregarImagen(id: number, url: string): Promise<Variante> {
    const variante = await this.repo.findOneBy({ id_variante: id });
    if (!variante) throw new NotFoundException(`Variante ${id} no encontrada`);
    const imagenesActuales = variante.imagenes || [];
    variante.imagenes = [...imagenesActuales, url];
    return this.repo.save(variante);
  }

  async bajaLogica(id: number): Promise<Variante> {
    await this.repo.update(id, { estado: EstadoVariante.INACTIVA });
    const variante = await this.repo.findOneBy({ id_variante: id });
    if (!variante) throw new NotFoundException(`Variante ${id} no encontrada`);
    return variante;
  }
}