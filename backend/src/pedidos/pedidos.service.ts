import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Venta, EstadoCompra } from '../venta/venta.entity.js';
import { DetalleVenta } from '../venta/detalle-venta.entity.js';
import { AuditoriaService } from '../auditoria/auditoria.service.js';
import { AccionAuditoria } from '../auditoria/log-auditoria.entity.js';
import { EmailService } from '../email/email.service.js';
import { ConfiguracionService } from '../configuracion/configuracion.service.js';
import { normalizarTexto, traducirErrorBD } from '../common/db-errors.js';
import { tomar } from '../common/auditoria-utils.js';
import { CambiarEstadoEnvioDto, ESTADOS_ENVIO } from './dto/cambiar-estado-envio.dto.js';

// Qué estado puede venir después de cuál, según el tipo de entrega
const TRANSICIONES: Record<'domicilio' | 'retiro', Record<string, string[]>> = {
  domicilio: {
    pendiente_despacho: ['despachado'],
    despachado: ['entregado'],
    entregado: [],
  },
  retiro: {
    pendiente_despacho: ['retiro_listo'],
    retiro_listo: ['entregado'],
    entregado: [],
  },
};

const MENSAJES_BD = {
  ck_venta_estado_envio: 'Estado de envío inválido',
};

export interface FiltrosPedidos {
  estado_envio?: string;
  tipo_entrega?: string;
  pagina?: number;
  limite?: number;
}

@Injectable()
export class PedidosService {
  private readonly logger = new Logger(PedidosService.name);

  constructor(
    @InjectRepository(Venta) private readonly ventaRepo: Repository<Venta>,
    @InjectRepository(DetalleVenta) private readonly detalleRepo: Repository<DetalleVenta>,
    private readonly auditoriaService: AuditoriaService,
    private readonly emailService: EmailService,
    private readonly configuracionService: ConfiguracionService,
  ) {}

  private resumen(v: Venta) {
    const productos = Number(v.precio_total);
    const envio = Number(v.costo_envio ?? 0);
    return {
      id_venta: v.id_venta,
      fecha_compra: v.fecha_compra,
      cliente: v.usuario ? `${v.usuario.nombre} ${v.usuario.apellido}`.trim() : null,
      email: v.usuario?.email ?? null,
      tipo_entrega: v.tipo_entrega,
      estado_envio: v.estado_envio,
      subtotal_productos: productos,
      costo_envio: envio,
      total: productos + envio,
      destino:
        v.tipo_entrega === 'domicilio'
          ? `${v.envio_calle} ${v.envio_numero}, ${v.envio_localidad}, ${v.envio_provincia}`
          : 'Retiro en local',
      transportista: v.transportista,
      numero_seguimiento: v.numero_seguimiento,
      fecha_despacho: v.fecha_despacho,
      fecha_entrega: v.fecha_entrega,
    };
  }

  // Solo ventas ya pagadas y con módulo de envíos (las viejas no tienen tipo_entrega)
  async listar(filtros: FiltrosPedidos = {}) {
    const limite = Math.min(Math.max(filtros.limite ?? 20, 1), 100);
    const pagina = Math.max(filtros.pagina ?? 1, 1);

    if (filtros.estado_envio && !(ESTADOS_ENVIO as readonly string[]).includes(filtros.estado_envio)) {
      throw new BadRequestException('Estado de envío inválido');
    }
    if (filtros.tipo_entrega && !['domicilio', 'retiro'].includes(filtros.tipo_entrega)) {
      throw new BadRequestException('Tipo de entrega inválido');
    }

    const qb = this.ventaRepo
      .createQueryBuilder('v')
      .leftJoinAndSelect('v.usuario', 'u')
      .where('v.estado_compra = :confirmada', { confirmada: EstadoCompra.CONFIRMADA })
      .andWhere('v.tipo_entrega IS NOT NULL');

    if (filtros.estado_envio) qb.andWhere('v.estado_envio = :estado', { estado: filtros.estado_envio });
    if (filtros.tipo_entrega) qb.andWhere('v.tipo_entrega = :tipo', { tipo: filtros.tipo_entrega });

    const [ventas, total] = await qb
      .orderBy('v.fecha_compra', 'DESC')
      .addOrderBy('v.id_venta', 'DESC')
      .skip((pagina - 1) * limite)
      .take(limite)
      .getManyAndCount();

    return { items: ventas.map((v) => this.resumen(v)), total, pagina, limite };
  }

  // ------------------------------------------------------------------
  // Vista del cliente: solo sus propios pedidos
  // ------------------------------------------------------------------
  private resumenCliente(v: Venta, items: DetalleVenta[]) {
    const productos = Number(v.precio_total);
    const envio = Number(v.costo_envio ?? 0);
    return {
      id_venta: v.id_venta,
      fecha_compra: v.fecha_compra,
      // Las compras anteriores al módulo de envíos no tienen tipo de entrega
      tipo_entrega: v.tipo_entrega,
      estado_envio: v.estado_envio,
      subtotal_productos: productos,
      costo_envio: envio,
      total: productos + envio,
      destino:
        v.tipo_entrega === 'domicilio'
          ? `${v.envio_calle} ${v.envio_numero}${v.envio_piso_depto ? `, ${v.envio_piso_depto}` : ''}, ${v.envio_localidad}, ${v.envio_provincia}`
          : v.tipo_entrega === 'retiro'
            ? 'Retiro en local'
            : null,
      transportista: v.transportista,
      numero_seguimiento: v.numero_seguimiento,
      fecha_despacho: v.fecha_despacho,
      fecha_entrega: v.fecha_entrega,
      items: items.map((d) => ({
        id_detalle: d.id_detalle,
        producto: d.variante?.producto?.nombre ?? d.sku_snapshot,
        cantidad: d.cantidad,
        precio_unitario: Number(d.precio_unitario),
        subtotal: Number(d.precio_unitario) * d.cantidad,
      })),
    };
  }

  // Solo compras ya pagadas; el id sale siempre del token, nunca del pedido
  async listarDeUsuario(id_usuario: number) {
    const ventas = await this.ventaRepo.find({
      where: { id_usuario, estado_compra: EstadoCompra.CONFIRMADA },
      order: { fecha_compra: 'DESC', id_venta: 'DESC' },
      take: 50,
    });
    if (ventas.length === 0) return [];

    const detalles = await this.detalleRepo.find({
      where: { id_venta: In(ventas.map((v) => v.id_venta)) },
      relations: { variante: { producto: true } },
      order: { id_detalle: 'ASC' },
    });

    return ventas.map((v) =>
      this.resumenCliente(
        v,
        detalles.filter((d) => d.id_venta === v.id_venta),
      ),
    );
  }

  private async buscarVenta(id_venta: number): Promise<Venta> {
    const venta = await this.ventaRepo.findOne({ where: { id_venta }, relations: { usuario: true } });
    if (!venta || venta.estado_compra !== EstadoCompra.CONFIRMADA || !venta.tipo_entrega) {
      throw new NotFoundException('Pedido no encontrado');
    }
    return venta;
  }

  async obtener(id_venta: number) {
    const venta = await this.buscarVenta(id_venta);
    const detalles = await this.detalleRepo.find({
      where: { id_venta },
      relations: { variante: { producto: true } },
      order: { id_detalle: 'ASC' },
    });

    return {
      ...this.resumen(venta),
      telefono_contacto: venta.envio_telefono,
      direccion:
        venta.tipo_entrega === 'domicilio'
          ? {
              destinatario: venta.envio_destinatario,
              telefono: venta.envio_telefono,
              calle: venta.envio_calle,
              numero: venta.envio_numero,
              piso_depto: venta.envio_piso_depto,
              localidad: venta.envio_localidad,
              provincia: venta.envio_provincia,
              codigo_postal: venta.envio_codigo_postal,
              observaciones: venta.envio_observaciones,
            }
          : null,
      items: detalles.map((d) => ({
        id_detalle: d.id_detalle,
        producto: d.variante?.producto?.nombre ?? d.sku_snapshot,
        sku: d.sku_snapshot,
        cantidad: d.cantidad,
        precio_unitario: Number(d.precio_unitario),
        subtotal: Number(d.precio_unitario) * d.cantidad,
      })),
    };
  }

  async cambiarEstado(id_venta: number, dto: CambiarEstadoEnvioDto, id_usuario_admin: number) {
    const antes = await this.buscarVenta(id_venta);
    const tipo = antes.tipo_entrega as 'domicilio' | 'retiro';
    const actual = antes.estado_envio ?? 'pendiente_despacho';
    const nuevo = dto.estado_envio;

    const transportista = dto.transportista !== undefined ? normalizarTexto(dto.transportista) : undefined;
    const seguimiento = dto.numero_seguimiento !== undefined ? normalizarTexto(dto.numero_seguimiento) : undefined;

    const mismoEstado = nuevo === actual;
    // Con el pedido ya despachado se puede corregir el transportista o el seguimiento
    const corrigeSeguimiento = mismoEstado && actual === 'despachado';

    if (!mismoEstado && !TRANSICIONES[tipo][actual]?.includes(nuevo)) {
      throw new BadRequestException(
        `No se puede pasar un pedido de ${tipo === 'retiro' ? 'retiro' : 'envío'} de "${actual}" a "${nuevo}"`,
      );
    }
    if (mismoEstado && !corrigeSeguimiento) {
      throw new BadRequestException('El pedido ya está en ese estado');
    }

    if (nuevo === 'despachado' && !transportista && !antes.transportista) {
      throw new BadRequestException('Indicá el transportista para despachar el pedido');
    }

    const cambios: Partial<Venta> = {};
    if (!mismoEstado) cambios.estado_envio = nuevo;
    if (transportista !== undefined) cambios.transportista = transportista || null;
    if (seguimiento !== undefined) cambios.numero_seguimiento = seguimiento || null;
    if (!mismoEstado && (nuevo === 'despachado' || nuevo === 'retiro_listo')) cambios.fecha_despacho = new Date();
    if (!mismoEstado && nuevo === 'entregado') cambios.fecha_entrega = new Date();

    try {
      await this.ventaRepo.update(id_venta, cambios);
    } catch (e) {
      traducirErrorBD(e, MENSAJES_BD);
    }

    const despues = await this.buscarVenta(id_venta);

    const claves = ['estado_envio', 'transportista', 'numero_seguimiento'].filter(
      (k) => String((antes as any)[k] ?? '') !== String((despues as any)[k] ?? ''),
    );
    if (claves.length > 0) {
      await this.auditoriaService.registrar({
        id_usuario: id_usuario_admin,
        accion: AccionAuditoria.EDITAR,
        entidad: 'Venta',
        id_entidad: id_venta,
        datos_anteriores: tomar(antes, claves),
        datos_nuevos: tomar(despues, claves),
      });
    }

    // El aviso por mail no debe romper el cambio de estado si falla
    if (!mismoEstado && (nuevo === 'despachado' || nuevo === 'retiro_listo')) {
      await this.avisarCliente(despues).catch((e) =>
        this.logger.error(`No se pudo avisar al cliente del pedido #${id_venta}`, e as Error),
      );
    }

    return this.resumen(despues);
  }

  private async avisarCliente(venta: Venta) {
    const email = venta.usuario?.email;
    if (!email) return;
    const nombre = venta.usuario.nombre;

    if (venta.estado_envio === 'despachado') {
      const lineas = [
        `Hola ${nombre}!`,
        '',
        `Tu pedido #${venta.id_venta} ya fue despachado.`,
        venta.transportista ? `Transportista: ${venta.transportista}` : '',
        venta.numero_seguimiento ? `Número de seguimiento: ${venta.numero_seguimiento}` : '',
        `Destino: ${venta.envio_calle} ${venta.envio_numero}, ${venta.envio_localidad}, ${venta.envio_provincia}`,
        '',
        'Gracias por elegir Belissa Joyas.',
      ].filter((l, i, arr) => l !== '' || arr[i - 1] !== '');
      await this.emailService.enviar(email, `Tu pedido #${venta.id_venta} está en camino`, lineas.join('\n'));
      return;
    }

    if (venta.estado_envio === 'retiro_listo') {
      let direccion = '';
      try {
        direccion = await this.configuracionService.findByClave('retiro_local_direccion');
      } catch (e) {
        if (!(e instanceof NotFoundException)) throw e;
      }
      const lineas = [
        `Hola ${nombre}!`,
        '',
        `Tu pedido #${venta.id_venta} ya está listo para retirar.`,
        direccion ? `Dónde y cuándo: ${direccion}` : '',
        '',
        'Gracias por elegir Belissa Joyas.',
      ].filter((l, i, arr) => l !== '' || arr[i - 1] !== '');
      await this.emailService.enviar(email, `Tu pedido #${venta.id_venta} está listo para retirar`, lineas.join('\n'));
    }
  }
}
