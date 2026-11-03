import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Configuracion } from './configuracion.entity.js';
import { AuditoriaService } from '../auditoria/auditoria.service.js';
import { AccionAuditoria } from '../auditoria/log-auditoria.entity.js';

@Injectable()
export class ConfiguracionService {
  constructor(
    @InjectRepository(Configuracion)
    private readonly repo: Repository<Configuracion>,
    private readonly auditoriaService: AuditoriaService,
  ) {}

  findAll() {
    return this.repo.find();
  }

  async findByClave(clave: string): Promise<string> {
    const config = await this.repo.findOneBy({ clave });
    if (!config) throw new NotFoundException(`Configuración '${clave}' no encontrada`);
    return config.valor;
  }

  async actualizar(clave: string, valor: string, id_usuario_admin?: number) {
    const config = await this.repo.findOneBy({ clave });
    if (!config) throw new NotFoundException(`Configuración '${clave}' no encontrada`);
    const valorAnterior = config.valor;
    config.valor = valor;
    const guardada = await this.repo.save(config);

    // La clave es texto, así que va en el detalle (id_entidad queda vacío).
    await this.auditoriaService.registrar({
      id_usuario: id_usuario_admin,
      accion: AccionAuditoria.EDITAR,
      entidad: 'Configuracion',
      id_entidad: null,
      datos_anteriores: { clave, valor: valorAnterior },
      datos_nuevos: { clave, valor: guardada.valor },
    });
    return guardada;
  }
}
