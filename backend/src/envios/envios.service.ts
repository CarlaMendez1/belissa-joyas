import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Provincia } from './provincia.entity.js';
import { DireccionEnvio } from './direccion-envio.entity.js';
import { TarifaEnvio } from './tarifa-envio.entity.js';
import { CrearDireccionDto } from './dto/crear-direccion.dto.js';
import { ActualizarDireccionDto } from './dto/actualizar-direccion.dto.js';
import { ActualizarTarifaDto } from './dto/actualizar-tarifa.dto.js';
import { ConfiguracionService } from '../configuracion/configuracion.service.js';
import { AuditoriaService } from '../auditoria/auditoria.service.js';
import { AccionAuditoria } from '../auditoria/log-auditoria.entity.js';
import { normalizarTexto, traducirErrorBD } from '../common/db-errors.js';
import { tomar } from '../common/auditoria-utils.js';

const MENSAJES_BD = {
  ck_direccion_codigo_postal: 'Código postal inválido (ej: 1425 o C1425ABC)',
  ck_direccion_telefono: 'El teléfono solo puede tener números, espacios, + - ( ) y al menos 6 dígitos',
  ck_direccion_textos_no_vacios: 'Ningún campo obligatorio puede estar vacío',
  ck_tarifa_precio: 'El precio no puede ser negativo',
  ck_tarifa_plazo: 'El plazo debe estar entre 1 y 60 días',
  uq_direccion_una_activa_por_usuario: 'Ya tenés una dirección cargada. Editala para cambiarla.',
};

export interface ResultadoCotizacion {
  tipo_entrega: 'domicilio' | 'retiro';
  costo: number;
  envio_gratis: boolean;
  plazo_dias: number | null;
  detalle: string;
}

@Injectable()
export class EnviosService {
  constructor(
    @InjectRepository(Provincia) private readonly provinciaRepo: Repository<Provincia>,
    @InjectRepository(DireccionEnvio) private readonly direccionRepo: Repository<DireccionEnvio>,
    @InjectRepository(TarifaEnvio) private readonly tarifaRepo: Repository<TarifaEnvio>,
    private readonly configuracionService: ConfiguracionService,
    private readonly auditoriaService: AuditoriaService,
  ) {}

  // ------------------------------------------------------------------
  // Catálogo y opciones públicas
  // ------------------------------------------------------------------
  listarProvincias() {
    return this.provinciaRepo.find({ order: { nombre: 'ASC' } });
  }

  private async config(clave: string, porDefecto: string): Promise<string> {
    try {
      return await this.configuracionService.findByClave(clave);
    } catch (e) {
      if (e instanceof NotFoundException) return porDefecto;
      throw e;
    }
  }

  async opcionesEntrega() {
    const [retiroActivo, retiroDireccion, gratisDesde] = await Promise.all([
      this.config('retiro_local_activo', 'false'),
      this.config('retiro_local_direccion', ''),
      this.config('envio_gratis_desde', '0'),
    ]);
    return {
      retiro_local_activo: retiroActivo.trim().toLowerCase() === 'true',
      retiro_local_direccion: retiroDireccion,
      envio_gratis_desde: Number(gratisDesde) || 0,
    };
  }

  // ------------------------------------------------------------------
  // Direcciones del cliente (cada una solo ve y toca las suyas)
  // ------------------------------------------------------------------
  listarDirecciones(id_usuario: number) {
    return this.direccionRepo.find({
      where: { id_usuario, activa: true },
      relations: { provincia: true },
      order: { es_predeterminada: 'DESC', id_direccion: 'DESC' },
    });
  }

  async buscarPropia(id_usuario: number, id_direccion: number): Promise<DireccionEnvio> {
    const direccion = await this.direccionRepo.findOne({
      where: { id_direccion, id_usuario, activa: true },
      relations: { provincia: true },
    });
    if (!direccion) throw new NotFoundException('Dirección no encontrada');
    return direccion;
  }

  private async validarProvincia(id_provincia: number) {
    const existe = await this.provinciaRepo.findOneBy({ id_provincia });
    if (!existe) throw new BadRequestException('La provincia indicada no existe');
  }

  private limpiar(dto: Partial<CrearDireccionDto>) {
    const salida: Partial<CrearDireccionDto> = { ...dto };
    for (const k of [
      'nombre_destinatario', 'telefono', 'calle', 'numero', 'piso_depto',
      'localidad', 'codigo_postal', 'observaciones',
    ] as const) {
      if (typeof salida[k] === 'string') salida[k] = normalizarTexto(salida[k] as string);
    }
    if (salida.codigo_postal) salida.codigo_postal = salida.codigo_postal.toUpperCase();
    return salida;
  }

  async crearDireccion(id_usuario: number, dto: CrearDireccionDto) {
    await this.validarProvincia(dto.id_provincia);
    const datos = this.limpiar(dto) as CrearDireccionDto;

    try {
      return await this.direccionRepo.manager.transaction(async (m) => {
        const cantidad = await m.count(DireccionEnvio, { where: { id_usuario, activa: true } });
        if (cantidad > 0) {
          throw new ConflictException('Ya tenés una dirección cargada. Editala para cambiarla.');
        }
        const creada = await m.save(DireccionEnvio, {
          ...datos,
          id_usuario,
          piso_depto: datos.piso_depto || null,
          observaciones: datos.observaciones || null,
          es_predeterminada: true,
        });
        return creada;
      });
    } catch (e) {
      traducirErrorBD(e, MENSAJES_BD);
    }
  }

  async actualizarDireccion(id_usuario: number, id_direccion: number, dto: ActualizarDireccionDto) {
    await this.buscarPropia(id_usuario, id_direccion);
    if (dto.id_provincia !== undefined) await this.validarProvincia(dto.id_provincia);
    const { es_predeterminada, ...resto } = this.limpiar(dto) as ActualizarDireccionDto;

    try {
      await this.direccionRepo.manager.transaction(async (m) => {
        if (es_predeterminada === true) {
          await m.update(DireccionEnvio, { id_usuario, es_predeterminada: true }, { es_predeterminada: false });
        }
        await m.update(DireccionEnvio, { id_direccion, id_usuario }, {
          ...resto,
          ...(resto.piso_depto !== undefined && { piso_depto: resto.piso_depto || null }),
          ...(resto.observaciones !== undefined && { observaciones: resto.observaciones || null }),
          ...(es_predeterminada === true && { es_predeterminada: true }),
        });
      });
    } catch (e) {
      traducirErrorBD(e, MENSAJES_BD);
    }
    return this.buscarPropia(id_usuario, id_direccion);
  }

  // ------------------------------------------------------------------
  // Tarifas (administración)
  // ------------------------------------------------------------------
  listarTarifas() {
    return this.tarifaRepo.find({
      relations: { provincia: true },
      order: { id_provincia: 'ASC' },
    });
  }

  async actualizarTarifa(id_tarifa: number, dto: ActualizarTarifaDto, id_usuario_admin?: number) {
    const antes = await this.tarifaRepo.findOne({ where: { id_tarifa }, relations: { provincia: true } });
    if (!antes) throw new NotFoundException('Tarifa no encontrada');

    const cambios: Partial<TarifaEnvio> = {};
    if (dto.precio !== undefined) cambios.precio = String(dto.precio);
    if (dto.plazo_dias !== undefined) cambios.plazo_dias = dto.plazo_dias;
    if (dto.activa !== undefined) cambios.activa = dto.activa;
    if (Object.keys(cambios).length === 0) return antes;

    try {
      await this.tarifaRepo.update(id_tarifa, cambios);
    } catch (e) {
      traducirErrorBD(e, MENSAJES_BD);
    }
    const despues = await this.tarifaRepo.findOneOrFail({
      where: { id_tarifa },
      relations: { provincia: true },
    });

    const claves = Object.keys(cambios).filter(
      (k) => String((antes as any)[k]) !== String((despues as any)[k]),
    );
    if (claves.length > 0) {
      await this.auditoriaService.registrar({
        id_usuario: id_usuario_admin,
        accion: AccionAuditoria.EDITAR,
        entidad: 'TarifaEnvio',
        id_entidad: id_tarifa,
        datos_anteriores: { provincia: antes.provincia.nombre, ...tomar(antes, claves) },
        datos_nuevos: { provincia: antes.provincia.nombre, ...tomar(despues, claves) },
      });
    }
    return despues;
  }

  // ------------------------------------------------------------------
  // Cálculo del costo. Lo usan la cotización (pantalla) y el pago (servidor).
  // ------------------------------------------------------------------
  async calcularCosto(datos: {
    tipo_entrega: 'domicilio' | 'retiro';
    id_provincia?: number;
    subtotal: number;
  }): Promise<ResultadoCotizacion> {
    const opciones = await this.opcionesEntrega();

    if (datos.tipo_entrega === 'retiro') {
      if (!opciones.retiro_local_activo) {
        throw new BadRequestException('El retiro en local no está disponible');
      }
      return {
        tipo_entrega: 'retiro',
        costo: 0,
        envio_gratis: false,
        plazo_dias: null,
        detalle: 'Retiro en local',
      };
    }

    if (!datos.id_provincia) {
      throw new BadRequestException('Falta la provincia de entrega');
    }

    const tarifa = await this.tarifaRepo.findOne({
      where: { id_provincia: datos.id_provincia, activa: true },
    });
    const precioBase = Number(await this.config('envio_precio_base', '0')) || 0;
    const precio = tarifa ? Number(tarifa.precio) : precioBase;
    const plazo = tarifa?.plazo_dias ?? null;

    const gratis = opciones.envio_gratis_desde > 0 && datos.subtotal >= opciones.envio_gratis_desde;
    return {
      tipo_entrega: 'domicilio',
      costo: gratis ? 0 : Math.round(precio * 100) / 100,
      envio_gratis: gratis,
      plazo_dias: plazo,
      detalle: gratis ? 'Envío gratis' : 'Envío a domicilio',
    };
  }
}
