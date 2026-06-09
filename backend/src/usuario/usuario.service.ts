import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Usuario } from './usuario.entity';

@Injectable()
export class UsuarioService {
  constructor(
    @InjectRepository(Usuario)
    private readonly repo: Repository<Usuario>,
  ) {}

  findAll(): Promise<Usuario[]> {
    return this.repo.find();
  }

  findById(id: number): Promise<Usuario | null> {
    return this.repo.findOneBy({ id_usuario: id });
  }

  findByEmail(email: string): Promise<Usuario | null> {
    return this.repo.findOneBy({ email });
  }

  save(usuario: Partial<Usuario>): Promise<Usuario> {
    return this.repo.save(usuario);
  }
}