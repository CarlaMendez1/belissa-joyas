import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { MercadoPagoConfig, Preference, Payment } from 'mercadopago';
import { Carrito, EstadoCarrito } from '../carrito/carrito.entity.js';
import { ItemCarrito } from '../item-carrito/item-carrito.entity.js';
import { Variante } from '../variante/variante.entity.js';
import { Venta, EstadoCompra } from '../venta/venta.entity.js';
import { DetalleVenta } from '../venta/detalle-venta.entity.js';
import { Pago, EstadoPago } from './pago.entity.js';
import { ClienteVipService } from '../cliente-vip/cliente-vip.service.js';
import { AuditoriaService } from '../auditoria/auditoria.service.js';
import { EnviosService } from '../envios/envios.service.js';
import { CrearPreferenciaDto } from './dto/crear-preferencia.dto.js';
import { AccionAuditoria } from '../auditoria/log-auditoria.entity.js';
import { EmailService } from '../email/email.service.js';
import { armarCorreoHtml } from '../email/plantilla-email.js';
import { NotificacionService } from '../notificacion/notificacion.service.js';
import { TipoNotificacion, EstadoNotificacion } from '../notificacion/notificacion.entity.js';

@Injectable()
export class PagoService {
  private readonly logger = new Logger(PagoService.name);
  private client: MercadoPagoConfig;

  constructor(
    @InjectRepository(Carrito) private readonly carritoRepo: Repository<Carrito>,
    @InjectRepository(ItemCarrito) private readonly itemRepo: Repository<ItemCarrito>,
    @InjectRepository(Variante) private readonly varianteRepo: Repository<Variante>,
    @InjectRepository(Venta) private readonly ventaRepo: Repository<Venta>,
    @InjectRepository(DetalleVenta) private readonly detalleRepo: Repository<DetalleVenta>,
    @InjectRepository(Pago) private readonly pagoRepo: Repository<Pago>,
    private readonly clienteVipService: ClienteVipService,
    private readonly configService: ConfigService,
    private readonly auditoriaService: AuditoriaService,
    private readonly enviosService: EnviosService,
    private readonly emailService: EmailService,
    private readonly notificacionService: NotificacionService,
  ) {
    this.client = new MercadoPagoConfig({
      accessToken: this.configService.get<string>('MP_ACCESS_TOKEN')!,
    });
  }

  // Calcula todo lo que el servidor necesita para cobrar: carrito, descuento VIP,
  // dirección y costo de envío. Lo usan tanto el resumen que ve el cliente como la
  // creación del pago, así los dos siempre coinciden.
  private async prepararCheckout(id_usuario: number, dto: CrearPreferenciaDto) {
    const carrito = await this.carritoRepo.findOne({
      where: { id_usuario, estado: EstadoCarrito.ACTIVO },
    });
    if (!carrito) throw new NotFoundException('No hay un carrito activo');

    const items = await this.itemRepo.find({
      where: { id_carrito: carrito.id_carrito },
      relations: { variante: { producto: true } },
    });
    if (items.length === 0) throw new BadRequestException('El carrito está vacío');

    const clienteVip = await this.clienteVipService.obtenerPorUsuario(id_usuario);
    const porcentajeDescuento = clienteVip ? Number(clienteVip.nivel.porcentaje_descuento) : 0;
    const factor = 1 - porcentajeDescuento / 100;

    const itemsConDescuento = items.map((item) => ({
      ...item,
      precio_con_descuento: Math.round(Number(item.precio_unitario) * factor * 100) / 100,
    }));

    const precioTotalConDescuento = itemsConDescuento.reduce(
      (acc, i) => acc + i.precio_con_descuento * i.cantidad,
      0,
    );

    // El costo de envío SIEMPRE lo calcula el servidor: nunca se confía en lo que
    // mande el navegador. El envío gratis se evalúa sobre el subtotal de productos.
    let direccion: Awaited<ReturnType<EnviosService['buscarPropia']>> | null = null;
    if (dto.tipo_entrega === 'domicilio') {
      if (!dto.id_direccion) throw new BadRequestException('Elegí una dirección de entrega');
      direccion = await this.enviosService.buscarPropia(id_usuario, dto.id_direccion);
    }
    const envio = await this.enviosService.calcularCosto({
      tipo_entrega: dto.tipo_entrega,
      id_provincia: direccion?.id_provincia,
      subtotal: precioTotalConDescuento,
    });

    return { carrito, itemsConDescuento, porcentajeDescuento, precioTotalConDescuento, direccion, envio };
  }

  // Resumen de lo que va a pagar el cliente (para mostrarlo antes de ir a Mercado Pago)
  async resumenCheckout(id_usuario: number, dto: CrearPreferenciaDto) {
    const { porcentajeDescuento, precioTotalConDescuento, envio } = await this.prepararCheckout(
      id_usuario,
      dto,
    );
    return {
      descuento_vip_porcentaje: porcentajeDescuento,
      subtotal_productos: Math.round(precioTotalConDescuento * 100) / 100,
      costo_envio: envio.costo,
      envio_gratis: envio.envio_gratis,
      plazo_dias: envio.plazo_dias,
      detalle_envio: envio.detalle,
      total: Math.round((precioTotalConDescuento + envio.costo) * 100) / 100,
    };
  }

  async crearPreferencia(id_usuario: number, dto: CrearPreferenciaDto) {
    const { carrito, itemsConDescuento, precioTotalConDescuento, direccion, envio } =
      await this.prepararCheckout(id_usuario, dto);

    const venta = await this.ventaRepo.save({
      id_usuario,
      id_carrito: carrito.id_carrito,
      precio_total: precioTotalConDescuento,
      estado_compra: EstadoCompra.PENDIENTE,
      metodo_pago: 'mercadopago',
      stock_descontado: false,
      tipo_entrega: dto.tipo_entrega,
      costo_envio: String(envio.costo),
      estado_envio: 'pendiente_despacho',
      // Copia de la dirección: si el cliente la edita después, este pedido no cambia
      ...(direccion && {
        id_direccion: direccion.id_direccion,
        envio_destinatario: direccion.nombre_destinatario,
        envio_telefono: direccion.telefono,
        envio_calle: direccion.calle,
        envio_numero: direccion.numero,
        envio_piso_depto: direccion.piso_depto,
        envio_localidad: direccion.localidad,
        envio_provincia: direccion.provincia.nombre,
        envio_codigo_postal: direccion.codigo_postal,
        envio_observaciones: direccion.observaciones,
      }),
    });

    for (const item of itemsConDescuento) {
      await this.detalleRepo.save({
        id_venta: venta.id_venta,
        id_variante: item.id_variante,
        sku_snapshot: item.variante.codigo_sku,
        cantidad: item.cantidad,
        precio_unitario: item.precio_con_descuento,
      });
    }

    const frontendUrl = this.configService.get<string>('FRONTEND_URL');
    const backendUrl = this.configService.get<string>('BACKEND_PUBLIC_URL');

    // Mercado Pago solo acepta auto_return con back_urls públicas en HTTPS:
    // en desarrollo (localhost) lo omitimos para que no rechace la preferencia.
    const autoReturn = frontendUrl?.startsWith('https://') ? ('approved' as const) : undefined;

    const notificationUrl = this.configService.get<string>('NOTIFICATION_URL') || `${backendUrl}/pago/webhook`;
    // Sin datos sensibles: sirve para detectar variables mal configuradas en producción
    this.logger.log(
      `Preferencia de pago (venta ${venta.id_venta}): FRONTEND_URL=${frontendUrl} | notification_url=${notificationUrl} | auto_return=${autoReturn ?? 'no'}`,
    );
    if (!frontendUrl || !backendUrl) {
      this.logger.warn('Falta FRONTEND_URL o BACKEND_PUBLIC_URL: Mercado Pago no podrá volver a la tienda ni avisar el pago');
    }

    const preference = new Preference(this.client);
    const resultado = await preference.create({
      body: {
        items: [
          ...itemsConDescuento.map((item) => ({
            id: String(item.id_variante),
            title: item.variante.producto?.nombre || item.variante.codigo_sku,
            quantity: item.cantidad,
            unit_price: item.precio_con_descuento,
            currency_id: 'ARS',
          })),
          // Mercado Pago no acepta ítems de $0: solo se agrega si hay costo
          ...(envio.costo > 0
            ? [{ id: 'envio', title: 'Envío a domicilio', quantity: 1, unit_price: envio.costo, currency_id: 'ARS' }]
            : []),
        ],
        external_reference: String(venta.id_venta),
        back_urls: {
          success: `${frontendUrl}/pago/exito`,
          failure: `${frontendUrl}/pago/error`,
          pending: `${frontendUrl}/pago/pendiente`,
        },
        ...(autoReturn && { auto_return: autoReturn }),
        notification_url: notificationUrl,
      },
    });

    await this.pagoRepo.save({
      id_venta: venta.id_venta,
      id_preferencia_mp: resultado.id!,
      estado_pago: EstadoPago.PENDIENTE,
      // Lo que realmente paga el cliente: productos + envío
      monto_abonado: Math.round((Number(venta.precio_total) + envio.costo) * 100) / 100,
    });

    return { init_point: resultado.init_point, id_venta: venta.id_venta };
  }

  async procesarWebhook(query: any, body: any) {
    const paymentId = query?.['data.id'] || body?.data?.id || query?.id;
    const type = query?.type || body?.type || query?.topic;

    if (type !== 'payment' || !paymentId) {
      return { recibido: true };
    }

    const paymentClient = new Payment(this.client);
    let pagoMP;
    try {
      pagoMP = await paymentClient.get({ id: paymentId });
    } catch (error) {
      console.log('[WEBHOOK] No se pudo obtener el pago:', paymentId);
      return { recibido: true };
    }

    const id_venta = Number(pagoMP.external_reference);
    if (!id_venta) return { recibido: true };

    const estadoMap: Record<string, EstadoPago> = {
      approved: EstadoPago.APROBADO,
      rejected: EstadoPago.RECHAZADO,
      pending: EstadoPago.PENDIENTE,
      in_process: EstadoPago.PENDIENTE,
      refunded: EstadoPago.REEMBOLSADO,
    };
    const nuevoEstado = estadoMap[pagoMP.status || ''] || EstadoPago.PENDIENTE;

    // Actualizamos el registro de pago siempre (informativo), pero esto
    // YA NO es la barrera contra doble descuento — esa vive más abajo,
    // protegida por transacción + lock pesimista sobre la Venta.
    await this.pagoRepo
      .createQueryBuilder()
      .update(Pago)
      .set({
        estado_pago: nuevoEstado,
        fecha_pago: new Date(),
        medio_pago: pagoMP.payment_method_id || '',
        referencia_compra: String(pagoMP.id),
      })
      .where('id_venta = :id_venta', { id_venta })
      .execute();

    if (nuevoEstado === EstadoPago.RECHAZADO) {
      const ventaAntes = await this.ventaRepo.findOneBy({ id_venta });
      await this.ventaRepo.update(id_venta, { estado_compra: EstadoCompra.CANCELADA });
      if (ventaAntes && ventaAntes.estado_compra !== EstadoCompra.CANCELADA) {
        await this.auditarSeguro({
          accion: AccionAuditoria.EDITAR,
          entidad: 'Venta',
          id_entidad: id_venta,
          datos_anteriores: { estado_compra: ventaAntes.estado_compra },
          datos_nuevos: { estado_compra: EstadoCompra.CANCELADA, motivo: 'Pago rechazado' },
        });
      }
      return { recibido: true };
    }

    if (nuevoEstado !== EstadoPago.APROBADO) {
      return { recibido: true };
    }

    const seDescontoAhora = await this.procesarStockYCarrito(id_venta);

    // Recalculamos VIP FUERA de la transacción, y solo si esta ejecución
    // fue la que realmente descontó el stock (evita duplicar el recálculo
    // y evita que recalcularNivel interfiera con los locks de la transacción).
    if (seDescontoAhora) {
      // Primero avisamos de la compra (el aviso de nivel VIP, si corresponde, sale después)
      await this.enviarConfirmacionCompra(id_venta);

      const venta = await this.ventaRepo.findOneBy({ id_venta });
      if (venta?.id_usuario) {
        try {
          await this.clienteVipService.recalcularNivel(venta.id_usuario);
        } catch (e) {
          console.error('[WEBHOOK] error en recalcularNivel:', e);
        }
      }
    }

    return { recibido: true };
  }

  // Fecha y hora en horario de Argentina (el servidor guarda y corre en UTC)
  private formatearFechaHora(fecha: Date): string {
    const f = new Date(fecha);
    const zona = 'America/Argentina/Buenos_Aires';
    const dia = f.toLocaleDateString('es-AR', { timeZone: zona, day: '2-digit', month: '2-digit', year: 'numeric' });
    const hora = f.toLocaleTimeString('es-AR', { timeZone: zona, hour: '2-digit', minute: '2-digit', hour12: false });
    return `${dia} ${hora} hs`;
  }

  // Correo de "Recibimos tu pago". Nunca debe romper el webhook: si falla, solo se registra.
  private async enviarConfirmacionCompra(id_venta: number): Promise<void> {
    try {
      const venta = await this.ventaRepo.findOne({
        where: { id_venta },
        relations: { usuario: true },
      });
      const email = venta?.usuario?.email;
      if (!venta || !email) return;

      const detalles = await this.detalleRepo.find({
        where: { id_venta },
        relations: { variante: { producto: true } },
      });

      // El pedido guarda los precios ya con descuento; los de lista siguen en el
      // carrito, que queda asociado a la venta. Con eso se muestra el descuento aplicado.
      const itemsCarrito = venta.id_carrito
        ? await this.itemRepo.find({ where: { id_carrito: venta.id_carrito } })
        : [];
      const precioLista = new Map(itemsCarrito.map((i) => [i.id_variante, Number(i.precio_unitario)]));

      const pesos = (n: number) =>
        `$${n.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

      const lineas = detalles.map((d) => {
        const lista = precioLista.get(d.id_variante) ?? Number(d.precio_unitario);
        return {
          nombre: d.variante?.producto?.nombre || d.sku_snapshot,
          cantidad: d.cantidad,
          importe: lista * d.cantidad,
        };
      });
      const subtotalLista = lineas.reduce((acc, l) => acc + l.importe, 0);
      const subtotal = Number(venta.precio_total);
      const descuento = Math.round((subtotalLista - subtotal) * 100) / 100;
      const porcentaje = subtotalLista > 0 ? Math.round((descuento / subtotalLista) * 100) : 0;
      const costoEnvio = Number(venta.costo_envio || 0);
      const total = subtotal + costoEnvio;

      const productos = lineas.map((l) => ({ ...l, importe: pesos(l.importe) }));
      const aDomicilio = venta.tipo_entrega === 'domicilio';
      const direccion = `${venta.envio_calle} ${venta.envio_numero}, ${venta.envio_localidad}, ${venta.envio_provincia}`;
      const entrega = aDomicilio ? `Envío a domicilio: ${direccion}` : 'Retiro en el local';
      const costoEnvioTexto = costoEnvio > 0 ? pesos(costoEnvio) : 'Gratis';
      const siguiente = aDomicilio
        ? 'Te avisaremos por correo cuando despachemos tu pedido.'
        : 'Te avisaremos por correo cuando tu pedido esté listo para retirar.';
      const nombre = venta.usuario.nombre;
      const fechaCompra = this.formatearFechaHora(venta.fecha_compra ?? new Date());
      const hayDescuento = descuento > 0.005;

      const texto = [
        `Hola ${nombre}!`,
        '',
        `Recibimos tu pago. Tu pedido #${id_venta} está confirmado.`,
        '',
        `Fecha y hora de la compra: ${fechaCompra}`,
        '',
        'Detalle de tu compra:',
        ...productos.map((p) => `- ${p.nombre} x${p.cantidad}: ${p.importe}`),
        '',
        ...(hayDescuento
          ? [`Subtotal: ${pesos(subtotalLista)}`, `Descuento VIP (${porcentaje}%): -${pesos(descuento)}`]
          : [`Subtotal: ${pesos(subtotal)}`]),
        `Envío: ${costoEnvioTexto}`,
        `Total pagado: ${pesos(total)}`,
        '',
        `Entrega: ${entrega}`,
        '',
        siguiente,
        'Gracias por elegir Belissa Joyas.',
      ].join('\n');

      const html = armarCorreoHtml({
        saludo: `Hola ${nombre}!`,
        parrafos: [`Recibimos tu pago. Tu pedido #${id_venta} está confirmado.`, 'Este es el detalle de tu compra:'],
        productos,
        datos: [
          { etiqueta: 'Fecha y hora', valor: fechaCompra },
          ...(hayDescuento
            ? [
                { etiqueta: 'Subtotal', valor: pesos(subtotalLista) },
                { etiqueta: `Descuento VIP (${porcentaje}%)`, valor: `-${pesos(descuento)}` },
              ]
            : [{ etiqueta: 'Subtotal', valor: pesos(subtotal) }]),
          { etiqueta: 'Envío', valor: costoEnvioTexto },
          { etiqueta: 'Total pagado', valor: pesos(total), destacado: true },
          { etiqueta: 'Entrega', valor: aDomicilio ? direccion : 'Retiro en el local' },
        ],
        // `siguiente` va como último párrafo para que lo último que se lea sea qué pasa ahora
        pie: `${siguiente} Gracias por elegir Belissa Joyas.`,
      });

      const enviado = await this.emailService.enviar(
        email,
        `Recibimos tu pago - Pedido #${id_venta}`,
        texto,
        html,
      );

      await this.notificacionService.registrar({
        id_usuario: venta.id_usuario,
        id_venta,
        tipo: TipoNotificacion.ESTADO_PAGO,
        contenido: texto,
        estado_entrega: enviado ? EstadoNotificacion.ENVIADO : EstadoNotificacion.FALLIDO,
      });
    } catch (e) {
      this.logger.error(`No se pudo enviar el correo de confirmación del pedido #${id_venta}`, e as Error);
    }
  }

  // Descuenta stock y confirma la venta de forma atómica, protegida por
  // transacción + lock pesimista sobre la fila de Venta. Devuelve true
  // solo si esta llamada fue la que efectivamente descontó el stock
  // (para que el llamador sepa si debe recalcular VIP, mandar notificación, etc).
  private async procesarStockYCarrito(id_venta: number): Promise<boolean> {
    const dataSource = this.ventaRepo.manager.connection;
    // Lo que se descontó, para auditarlo recién cuando la transacción se confirmó
    let descuentos: { id_variante: number; sku: string; cantidad: number }[] = [];
    let estadoAnterior: string | undefined;

    const descontado = await dataSource.transaction(async (manager) => {
      const venta = await manager.findOne(Venta, {
        where: { id_venta },
        lock: { mode: 'pessimistic_write' },
      });

      if (!venta) {
        console.error(`[WEBHOOK] No existe la venta ${id_venta}`);
        return false;
      }

      if (venta.stock_descontado) {
        console.log(`[WEBHOOK] Stock de venta ${id_venta} ya descontado, se ignora este webhook duplicado.`);
        return false;
      }

      estadoAnterior = venta.estado_compra;
      const detalles = await manager.find(DetalleVenta, { where: { id_venta } });
      descuentos = detalles.map((d) => ({
        id_variante: d.id_variante,
        sku: d.sku_snapshot,
        cantidad: d.cantidad,
      }));

      for (const detalle of detalles) {
        await manager
          .createQueryBuilder()
          .update(Variante)
          .set({ stock_disponible: () => `stock_disponible - ${detalle.cantidad}` })
          .where('id_variante = :id_variante', { id_variante: detalle.id_variante })
          .execute();
      }

      console.log(`[WEBHOOK] Stock descontado para venta ${id_venta}`);

      await manager.update(
        Venta,
        { id_venta },
        { estado_compra: EstadoCompra.CONFIRMADA, stock_descontado: true },
      );

      if (venta.id_carrito) {
        await manager.update(Carrito, { id_carrito: venta.id_carrito }, { estado: EstadoCarrito.CONVERTIDO });
        console.log(`[WEBHOOK] Carrito ${venta.id_carrito} convertido`);
      }

      return true;
    });

    if (descontado) {
      // Acciones del sistema (webhook de Mercado Pago): sin usuario.
      // Solo ids, SKU y cantidades: no se guardan datos de pago.
      await this.auditarSeguro({
        accion: AccionAuditoria.EDITAR,
        entidad: 'Venta',
        id_entidad: id_venta,
        datos_anteriores: { estado_compra: estadoAnterior, stock_descontado: false },
        datos_nuevos: { estado_compra: EstadoCompra.CONFIRMADA, stock_descontado: true },
      });
      for (const d of descuentos) {
        await this.auditarSeguro({
          accion: AccionAuditoria.EDITAR,
          entidad: 'Variante',
          id_entidad: d.id_variante,
          datos_anteriores: null,
          datos_nuevos: { sku: d.sku, stock_descontado_por_venta: d.cantidad, id_venta },
        });
      }
    }
    return descontado;
  }

  // La auditoría nunca debe romper el flujo de un pago ya aprobado.
  private async auditarSeguro(datos: {
    accion: AccionAuditoria;
    entidad: string;
    id_entidad: number | null;
    datos_anteriores?: any;
    datos_nuevos?: any;
  }) {
    try {
      await this.auditoriaService.registrar({ id_usuario: null, ...datos });
    } catch (e) {
      console.error('[AUDITORIA] No se pudo registrar:', e);
    }
  }
}
