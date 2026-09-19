// backend/src/nivel-vip/nivel-vip.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NivelVip } from './nivel-vip.entity.js';

@Injectable()
export class NivelVipService {
  constructor(
    @InjectRepository(NivelVip)
    private readonly repo: Repository<NivelVip>,
  ) {}

  findAll() {
    return this.repo.find({ order: { monto_min_requerido: 'ASC' } });
  }

  async findById(id: number) {
    const nivel = await this.repo.findOneBy({ id_nivel_vip: id });
    if (!nivel) throw new NotFoundException('Nivel VIP no encontrado');
    return nivel;
  }

  async update(id: number, data: Partial<NivelVip>) {
    const nivel = await this.findById(id);
    Object.assign(nivel, data);
    return this.repo.save(nivel);
  }
}