import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Producto, EstadoProducto } from './producto.entity.js';
import { CrearProductoDto } from './dto/crear-producto.dto.js';

@Injectable()
export class ProductoService {
  constructor(
    @InjectRepository(Producto)
    private readonly repo: Repository<Producto>,
  ) {}

  findAll(): Promise<Producto[]> {
    return this.repo.find({ where: { estado: EstadoProducto.ACTIVO } });
  }

  async findById(id: number): Promise<Producto> {
    const producto = await this.repo.findOneBy({ id_producto: id });
    if (!producto) throw new NotFoundException(`Producto ${id} no encontrado`);
    return producto;
  }

  async create(dto: CrearProductoDto): Promise<Producto> {
    // Generar SKU automático — RF4
    const sku = `BEL-${Date.now()}`;
    return this.repo.save({ ...dto, codigo_sku: sku });
  }

  async update(id: number, data: Partial<Producto>): Promise<Producto> {
    await this.repo.update(id, data);
    return this.findById(id);
  }

  async bajaLogica(id: number): Promise<Producto> {
    await this.repo.update(id, { estado: EstadoProducto.INACTIVO });
    return this.findById(id);
  }
}