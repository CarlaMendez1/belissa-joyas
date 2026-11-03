import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Caracteristica } from './caracteristica.entity.js';
import { CrearCaracteristicaDto } from './dto/crear-caracteristica.dto.js';
import { ActualizarCaracteristicaDto } from './dto/actualizar-caracteristica.dto.js';
import { Opcion } from '../opcion/opcion.entity.js';
import { normalizarTexto, traducirErrorBD } from '../common/db-errors.js';
import { tomar } from '../common/auditoria-utils.js';
import { AuditoriaService } from '../auditoria/auditoria.service.js';
import { AccionAuditoria } from '../auditoria/log-auditoria.entity.js';

const MENSAJES_BD = {
  uq_caracteristica_valor_por_opcion: 'Esa opción ya tiene una característica con ese valor',
  ck_caracteristica_valor_no_vacio: 'El valor no puede estar vacío',
};
const REGEX_NUMERO = /^[0-9]+(\.[0-9]+)?$/;

@Injectable()
export class CaracteristicaService {
  constructor(
    @InjectRepository(Caracteristica)
    private readonly repo: Repository<Caracteristica>,
    @InjectRepository(Opcion)
    private readonly opcionRepo: Repository<Opcion>,
    private readonly auditoriaService: AuditoriaService,
  ) {}

  // Mensaje amigable; la garantía final es el trigger de la BD.
  // Si la opción es numérica acepta coma o punto decimal y guarda con punto.
  private async prepararValor(id_opcion: number, valor: string): Promise<string> {
    const opcion = await this.opcionRepo.findOneBy({ id_opcion });
    if (!opcion) throw new NotFoundException('Opción no encontrada');
    let limpio = normalizarTexto(valor);
    if (opcion.tipo_dato === 'numero') {
      limpio = limpio.replace(',', '.');
      if (!REGEX_NUMERO.test(limpio)) {
        throw new BadRequestException(
          `"${valor}" no es válido: "${opcion.nombre}" es numérica (en ${opcion.unidad}) y solo admite números, ej: 12 o 12.5`,
        );
      }
    }
    return limpio;
  }

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

  private async nombreOpcion(id_opcion: number): Promise<string | null> {
    const o = await this.opcionRepo.findOneBy({ id_opcion });
    return o?.nombre ?? null;
  }

  async create(dto: CrearCaracteristicaDto, id_usuario_admin?: number) {
    const valor = await this.prepararValor(dto.id_opcion, dto.valor);
    try {
      const creada = await this.repo.save({ id_opcion: dto.id_opcion, valor });
      await this.auditoriaService.registrar({
        id_usuario: id_usuario_admin,
        accion: AccionAuditoria.CREAR,
        entidad: 'Caracteristica',
        id_entidad: creada.id_caracteristica,
        datos_nuevos: { opcion: await this.nombreOpcion(dto.id_opcion), valor },
      });
      return creada;
    } catch (e) {
      traducirErrorBD(e, MENSAJES_BD);
    }
  }

  async update(id_caracteristica: number, dto: ActualizarCaracteristicaDto, id_usuario_admin?: number) {
    const caracteristica = await this.findById(id_caracteristica);
    const antes = {
      opcion: await this.nombreOpcion(caracteristica.id_opcion),
      valor: caracteristica.valor,
    };
    const id_opcion = dto.id_opcion ?? caracteristica.id_opcion;
    caracteristica.id_opcion = id_opcion;
    if (dto.valor !== undefined || dto.id_opcion !== undefined) {
      caracteristica.valor = await this.prepararValor(id_opcion, dto.valor ?? caracteristica.valor);
    }
    try {
      const guardada = await this.repo.save(caracteristica);
      const despues = {
        opcion: await this.nombreOpcion(guardada.id_opcion),
        valor: guardada.valor,
      };
      const cambiados = Object.keys(despues).filter(
        (k) => (antes as any)[k] !== (despues as any)[k],
      );
      if (cambiados.length > 0) {
        await this.auditoriaService.registrar({
          id_usuario: id_usuario_admin,
          accion: AccionAuditoria.EDITAR,
          entidad: 'Caracteristica',
          id_entidad: id_caracteristica,
          datos_anteriores: tomar(antes, cambiados),
          datos_nuevos: tomar(despues, cambiados),
        });
      }
      return guardada;
    } catch (e) {
      traducirErrorBD(e, MENSAJES_BD);
    }
  }

  async remove(id_caracteristica: number, id_usuario_admin?: number) {
    const caracteristica = await this.findById(id_caracteristica);
    const opcion = await this.nombreOpcion(caracteristica.id_opcion);
    await this.repo.remove(caracteristica);
    await this.auditoriaService.registrar({
      id_usuario: id_usuario_admin,
      accion: AccionAuditoria.ELIMINAR,
      entidad: 'Caracteristica',
      id_entidad: id_caracteristica,
      datos_anteriores: { opcion, valor: caracteristica.valor },
    });
    return { mensaje: 'Característica eliminada' };
  }
}
