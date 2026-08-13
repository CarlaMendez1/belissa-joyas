
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Configuracion } from './configuracion.entity.js';

@Injectable()
export class ConfiguracionService {
  constructor(
    @InjectRepository(Configuracion)
    private readonly repo: Repository<Configuracion>,
  ) {}

  findAll() {
    return this.repo.find();
  }

  async findByClave(clave: string): Promise<string> {
    const config = await this.repo.findOneBy({ clave });
    if (!config) throw new NotFoundException(`Configuración '${clave}' no encontrada`);
    return config.valor;
  }

  async actualizar(clave: string, valor: string) {
    const config = await this.repo.findOneBy({ clave });
    if (!config) throw new NotFoundException(`Configuración '${clave}' no encontrada`);
    config.valor = valor;
    return this.repo.save(config);
  }
}