import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Caracteristica } from './caracteristica.entity.js';
import { CrearCaracteristicaDto } from './dto/crear-caracteristica.dto.js';
import { ActualizarCaracteristicaDto } from './dto/actualizar-caracteristica.dto.js';

@Injectable()
export class CaracteristicaService {
  constructor(
    @InjectRepository(Caracteristica)
    private readonly repo: Repository<Caracteristica>,
  ) {}

  findAll() {
    return this.repo.find({ relations: { opcion: true }, order: { id_opcion: 'ASC' } });
  }

  findPorOpcion(id_opcion: number) {
    return this.repo.find({ where: { id_opcion }, order: { valor: 'ASC' } });
  }

  async findById(id_caracteristica: number) {
    const caracteristica = await this.repo.findOneBy({ id_caracteristica });
    if (!caracteristica) throw new NotFoundException('Característica no encontrada');
    return caracteristica;
  }

  create(dto: CrearCaracteristicaDto) {
    return this.repo.save(dto);
  }

  async update(id_caracteristica: number, dto: ActualizarCaracteristicaDto) {
    const caracteristica = await this.findById(id_caracteristica);
    Object.assign(caracteristica, dto);
    return this.repo.save(caracteristica);
  }

  async remove(id_caracteristica: number) {
    const caracteristica = await this.findById(id_caracteristica);
    await this.repo.remove(caracteristica);
    return { mensaje: 'Característica eliminada' };
  }
}