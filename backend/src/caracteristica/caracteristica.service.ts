import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Caracteristica } from './caracteristica.entity.js';
import { CrearCaracteristicaDto } from './dto/crear-caracteristica.dto.js';
import { ActualizarCaracteristicaDto } from './dto/actualizar-caracteristica.dto.js';
import { Opcion } from '../opcion/opcion.entity.js';
import { normalizarTexto, traducirErrorBD } from '../common/db-errors.js';

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

  async create(dto: CrearCaracteristicaDto) {
    const valor = await this.prepararValor(dto.id_opcion, dto.valor);
    try {
      return await this.repo.save({ id_opcion: dto.id_opcion, valor });
    } catch (e) {
      traducirErrorBD(e, MENSAJES_BD);
    }
  }

  async update(id_caracteristica: number, dto: ActualizarCaracteristicaDto) {
    const caracteristica = await this.findById(id_caracteristica);
    const id_opcion = dto.id_opcion ?? caracteristica.id_opcion;
    caracteristica.id_opcion = id_opcion;
    if (dto.valor !== undefined || dto.id_opcion !== undefined) {
      caracteristica.valor = await this.prepararValor(id_opcion, dto.valor ?? caracteristica.valor);
    }
    try {
      return await this.repo.save(caracteristica);
    } catch (e) {
      traducirErrorBD(e, MENSAJES_BD);
    }
  }

  async remove(id_caracteristica: number) {
    const caracteristica = await this.findById(id_caracteristica);

    // No se puede borrar un valor que alguna variante está usando
    const [{ cantidad }] = await this.repo.manager.query(
      'SELECT COUNT(*)::int AS cantidad FROM variante_caracteristica WHERE id_caracteristica = $1',
      [id_caracteristica],
    );
    if (cantidad > 0) {
      throw new ConflictException(
        `No se puede eliminar "${caracteristica.valor}": lo usan ${cantidad} ${
          cantidad === 1 ? 'variante' : 'variantes'
        }. Quitalo primero de esas variantes.`,
      );
    }

    await this.repo.remove(caracteristica);
    return { mensaje: 'Característica eliminada' };
  }
}