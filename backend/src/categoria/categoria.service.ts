import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Categoria, EstadoGeneral } from './categoria.entity';

@Injectable()
export class CategoriaService {
  constructor(
    @InjectRepository(Categoria)
    private readonly repo: Repository<Categoria>,
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

  create(data: Partial<Categoria>): Promise<Categoria> {
    return this.repo.save(data);
  }

  async update(id: number, data: Partial<Categoria>): Promise<Categoria> {
    await this.repo.update(id, data);
    return this.findById(id);
  }

  async bajaLogica(id: number): Promise<Categoria> {
    await this.repo.update(id, { estado: EstadoGeneral.INACTIVA });
    return this.findById(id);
  }
}