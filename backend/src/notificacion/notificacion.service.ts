
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notificacion } from './notificacion.entity.js';

@Injectable()
export class NotificacionService {
  constructor(
    @InjectRepository(Notificacion)
    private readonly repo: Repository<Notificacion>,
  ) {}

  registrar(data: Partial<Notificacion>) {
    return this.repo.save(data);
  }

  findByCarrito(id_carrito: number) {
    return this.repo.find({ where: { id_carrito } });
  }
}