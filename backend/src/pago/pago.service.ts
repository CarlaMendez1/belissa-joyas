import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
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

@Injectable()
export class PagoService {
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
  ) {
    this.client = new MercadoPagoConfig({
      accessToken: this.configService.get<string>('MP_ACCESS_TOKEN')!,
    });
  }

  async crearPreferencia(id_usuario: number) {
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

    const venta = await this.ventaRepo.save({
      id_usuario,
      id_carrito: carrito.id_carrito,
      precio_total: precioTotalConDescuento,
      estado_compra: EstadoCompra.PENDIENTE,
      metodo_pago: 'mercadopago',
      stock_descontado: false,
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

    const preference = new Preference(this.client);
    const resultado = await preference.create({
      body: {
        items: itemsConDescuento.map((item) => ({
          id: String(item.id_variante),
          title: item.variante.producto?.nombre || item.variante.codigo_sku,
          quantity: item.cantidad,
          unit_price: item.precio_con_descuento,
          currency_id: 'ARS',
        })),
        external_reference: String(venta.id_venta),
        back_urls: {
          success: `${frontendUrl}/pago/exito`,
          failure: `${frontendUrl}/pago/error`,
          pending: `${frontendUrl}/pago/pendiente`,
        },
        notification_url: this.configService.get<string>('NOTIFICATION_URL') || `${backendUrl}/pago/webhook`,
      },
    });

    await this.pagoRepo.save({
      id_venta: venta.id_venta,
      id_preferencia_mp: resultado.id!,
      estado_pago: EstadoPago.PENDIENTE,
      monto_abonado: venta.precio_total,
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
      await this.ventaRepo.update(id_venta, { estado_compra: EstadoCompra.CANCELADA });
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

  // Descuenta stock y confirma la venta de forma atómica, protegida por
  // transacción + lock pesimista sobre la fila de Venta. Devuelve true
  // solo si esta llamada fue la que efectivamente descontó el stock
  // (para que el llamador sepa si debe recalcular VIP, mandar notificación, etc).
  private async procesarStockYCarrito(id_venta: number): Promise<boolean> {
    const dataSource = this.ventaRepo.manager.connection;

    return dataSource.transaction(async (manager) => {
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

      const detalles = await manager.find(DetalleVenta, { where: { id_venta } });

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
  }
}