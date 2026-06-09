import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Subcategoria } from './subcategoria.entity';
import { EstadoGeneral } from '../categoria/categoria.entity';

@Injectable()
export class SubcategoriaService {
  constructor(
    @InjectRepository(Subcategoria)
    private readonly repo: Repository<Subcategoria>,
  ) {}

  findAll(): Promise<Subcategoria[]> {
    return this.repo.find({ where: { estado: EstadoGeneral.ACTIVA } });
  }

  findByCategoria(id_categoria: number): Promise<Subcategoria[]> {
    return this.repo.find({ where: { id_categoria, estado: EstadoGeneral.ACTIVA } });
  }

  create(data: Partial<Subcategoria>): Promise<Subcategoria> {
    return this.repo.save(data);
  }

  async update(id: number, data: Partial<Subcategoria>): Promise<Subcategoria | null> {
    await this.repo.update(id, data);
    return this.repo.findOneBy({ id_subcategoria: id });
  }

  // Baja lógica — RF11
  async bajaLogica(id: number): Promise<Subcategoria | null> {
    await this.repo.update(id, { estado: EstadoGeneral.INACTIVA });
    return this.repo.findOneBy({ id_subcategoria: id });
  }
}