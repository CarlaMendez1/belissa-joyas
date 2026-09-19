import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Opcion } from './opcion.entity.js';
import { Categoria } from '../categoria/categoria.entity.js';
import { CrearOpcionDto } from './dto/crear-opcion.dto.js';
import { ActualizarOpcionDto } from './dto/actualizar-opcion.dto.js';

@Injectable()
export class OpcionService {
  constructor(
    @InjectRepository(Opcion)
    private readonly repo: Repository<Opcion>,
    @InjectRepository(Categoria)
    private readonly categoriaRepo: Repository<Categoria>,
  ) {}

  // Trae las opciones junto con sus categorías asignadas,
  // para que el panel admin pueda mostrar/editar los checkboxes.
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
    const existente = await this.repo.findOneBy({ nombre: dto.nombre });
    if (existente) throw new ConflictException('Ya existe una opción con ese nombre');

    const categorias = await this.resolverCategorias(dto.categorias);
    return this.repo.save({ nombre: dto.nombre, categorias });
  }

  async update(id_opcion: number, dto: ActualizarOpcionDto) {
    const opcion = await this.findById(id_opcion);
    if (dto.nombre !== undefined) opcion.nombre = dto.nombre;
    if (dto.categorias !== undefined) {
      opcion.categorias = await this.resolverCategorias(dto.categorias);
    }
    return this.repo.save(opcion);
  }

  async remove(id_opcion: number) {
    const opcion = await this.findById(id_opcion);
    await this.repo.remove(opcion);
    return { mensaje: 'Opción eliminada' };
  }
}