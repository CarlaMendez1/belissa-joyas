import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Opcion } from './opcion.entity.js';
import { CrearOpcionDto } from './dto/crear-opcion.dto.js';
import { ActualizarOpcionDto } from './dto/actualizar-opcion.dto.js';

@Injectable()
export class OpcionService {
  constructor(
    @InjectRepository(Opcion)
    private readonly repo: Repository<Opcion>,
  ) {}

  findAll() {
    return this.repo.find({ order: { nombre: 'ASC' } });
  }

  async findById(id_opcion: number) {
    const opcion = await this.repo.findOneBy({ id_opcion });
    if (!opcion) throw new NotFoundException('Opción no encontrada');
    return opcion;
  }

  async create(dto: CrearOpcionDto) {
    const existente = await this.repo.findOneBy({ nombre: dto.nombre });
    if (existente) throw new ConflictException('Ya existe una opción con ese nombre');
    return this.repo.save(dto);
  }

  async update(id_opcion: number, dto: ActualizarOpcionDto) {
    const opcion = await this.findById(id_opcion);
    Object.assign(opcion, dto);
    return this.repo.save(opcion);
  }

  async remove(id_opcion: number) {
    const opcion = await this.findById(id_opcion);
    await this.repo.remove(opcion);
    return { mensaje: 'Opción eliminada' };
  }
}