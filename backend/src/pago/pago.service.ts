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

    // 1. Crear la venta en estado pendiente
    const venta = await this.ventaRepo.save({
      id_usuario,
      id_carrito: carrito.id_carrito,
      precio_total: carrito.precio_subtotal,
      estado_compra: EstadoCompra.PENDIENTE,
      metodo_pago: 'mercadopago',
    });

    // 2. Crear el detalle de venta (snapshot de lo comprado)
    for (const item of items) {
      await this.detalleRepo.save({
        id_venta: venta.id_venta,
        id_variante: item.id_variante,
        sku_snapshot: item.variante.codigo_sku,
        cantidad: item.cantidad,
        precio_unitario: item.precio_unitario,
      });
    }

    // 3. Crear la preferencia en Mercado Pago
    const frontendUrl = this.configService.get<string>('FRONTEND_URL');
    const backendUrl = this.configService.get<string>('BACKEND_PUBLIC_URL');

    const preference = new Preference(this.client);
    const resultado = await preference.create({
      body: {
        items: items.map((item) => ({
          id: String(item.id_variante),
          title: item.variante.producto?.nombre || item.variante.codigo_sku,
          quantity: item.cantidad,
          unit_price: Number(item.precio_unitario),
          currency_id: 'ARS',
        })),
        external_reference: String(venta.id_venta),
        back_urls: {
          success: `${frontendUrl}/pago/exito`,
          failure: `${frontendUrl}/pago/error`,
          pending: `${frontendUrl}/pago/pendiente`,
        },

        notification_url: `${backendUrl}/pago/webhook`,
      },
    });

    // 4. Guardar el registro de pago en estado pendiente
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
  const pagoMP = await paymentClient.get({ id: paymentId });

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

  // Actualización atómica: solo aplica si el estado actual NO es ya "aprobado".
  // Si dos webhooks llegan casi al mismo tiempo, Postgres serializa el UPDATE
  // sobre la misma fila: el segundo ve el nuevo estado y "affected" da 0.
  const resultado = await this.pagoRepo
    .createQueryBuilder()
    .update(Pago)
    .set({
      estado_pago: nuevoEstado,
      fecha_pago: new Date(),
      medio_pago: pagoMP.payment_method_id || '',
      referencia_compra: String(pagoMP.id),
    })
    .where('id_venta = :id_venta AND estado_pago != :aprobado', {
      id_venta,
      aprobado: EstadoPago.APROBADO,
    })
    .execute();

  if (resultado.affected === 0) {
    // Ya se había procesado antes (webhook duplicado) — no repetir el descuento de stock.
    return { recibido: true, yaProcesado: true };
  }

  if (nuevoEstado === EstadoPago.APROBADO) {
    await this.ventaRepo.update(id_venta, { estado_compra: EstadoCompra.CONFIRMADA });

    const venta = await this.ventaRepo.findOneBy({ id_venta });
    const detalles = await this.detalleRepo.find({ where: { id_venta } });

    for (const detalle of detalles) {
      await this.varianteRepo.decrement(
        { id_variante: detalle.id_variante },
        'stock_disponible',
        detalle.cantidad,
      );
    }

    if (venta?.id_carrito) {
      await this.carritoRepo.update(venta.id_carrito, {
        estado: EstadoCarrito.CONVERTIDO,
      });
    }
  } else if (nuevoEstado === EstadoPago.RECHAZADO) {
    await this.ventaRepo.update(id_venta, { estado_compra: EstadoCompra.CANCELADA });
  }

  return { recibido: true };
}
}
