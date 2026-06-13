import { Injectable, NotFoundException } from '@nestjs/common';
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

  async create(dto: CrearVarianteDto): Promise<Variante> {
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

  async bajaLogica(id: number): Promise<Variante> {
    await this.repo.update(id, { estado: EstadoVariante.INACTIVA });
    const variante = await this.repo.findOneBy({ id_variante: id });
    if (!variante) throw new NotFoundException(`Variante ${id} no encontrada`);
    return variante;
  }
}