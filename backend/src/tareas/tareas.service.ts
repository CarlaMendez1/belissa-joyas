import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Raw, Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Carrito, EstadoCarrito } from '../carrito/carrito.entity.js';
import { ItemCarrito } from '../item-carrito/item-carrito.entity.js';
import { ConfiguracionService } from '../configuracion/configuracion.service.js';
import { NotificacionService } from '../notificacion/notificacion.service.js';
import { TipoNotificacion, EstadoNotificacion } from '../notificacion/notificacion.entity.js';
import { EmailService } from '../email/email.service.js';
import { ClienteVipService } from '../cliente-vip/cliente-vip.service.js';

@Injectable()
export class TareasService {
  private readonly logger = new Logger(TareasService.name);

  constructor(
    @InjectRepository(Carrito)
    private readonly carritoRepo: Repository<Carrito>,
    @InjectRepository(ItemCarrito)
    private readonly itemRepo: Repository<ItemCarrito>,
    private readonly configuracionService: ConfiguracionService,
    private readonly notificacionService: NotificacionService,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
    private readonly clienteVipService: ClienteVipService,
  ) {}


  // Corre cada 30 segundos
  @Cron('*/30 * * * * *')
  async detectarCarritosAbandonados() {
    const minutosStr = await this.configuracionService.findByClave('tiempo_abandono_carrito_minutos');
    const minutos = Number(minutosStr);
    const limite = new Date(Date.now() - minutos * 60 * 1000);

    const carritosVencidos = await this.carritoRepo.find({
  where: {
    estado: EstadoCarrito.ACTIVO,
    fecha_ultima_act: Raw((alias) => `${alias} < NOW() - INTERVAL '${minutos} minutes'`),
  },
  relations: { usuario: true },
});
    this.logger.log(`Revisando carritos abandonados: ${carritosVencidos.length} candidatos`);

    for (const carrito of carritosVencidos) {
      const items = await this.itemRepo.find({
        where: { id_carrito: carrito.id_carrito },
        relations: { variante: { producto: true } },
      });

      if (items.length === 0) {
        // Carrito vacío, no tiene sentido notificar — lo marcamos igual para no reprocesarlo
        await this.carritoRepo.update(carrito.id_carrito, { estado: EstadoCarrito.ABANDONADO });
        continue;
      }

      const nombreCliente = carrito.usuario?.nombre || 'cliente';
      const frontendUrl = this.configService.get<string>('FRONTEND_URL');

      const listaProductosTexto = items
        .map((i) => `- ${i.variante?.producto?.nombre || i.variante?.codigo_sku} x${i.cantidad}`)
        .join('\n');

      const contenido = `Hola ${nombreCliente},

Notamos que dejaste estos productos en tu carrito de Belissa Joyas:

${listaProductosTexto}

¡Todavía están disponibles! Completá tu compra antes de que se agoten.

Volvé a la tienda acá: ${frontendUrl}`;

      const filasProductosHtml = items
        .map(
          (i) => `
            <tr>
              <td style="padding: 12px 0; border-bottom: 1px solid #eee; color: #44403c; font-size: 14px;">
                ${i.variante?.producto?.nombre || i.variante?.codigo_sku}
              </td>
              <td style="padding: 12px 0; border-bottom: 1px solid #eee; color: #78716c; font-size: 14px; text-align: right;">
                x${i.cantidad}
              </td>
            </tr>`
        )
        .join('');

      const html = `
        <div style="font-family: Georgia, 'Times New Roman', serif; background-color: #fafaf9; padding: 32px 16px;">
          <div style="max-width: 480px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e7e5e4;">
            <div style="background: linear-gradient(135deg, #b45309, #92400e); padding: 28px 24px; text-align: center;">
              <h1 style="color: #ffffff; font-size: 22px; margin: 0; font-weight: normal; letter-spacing: 0.5px;">
                Belissa Joyas
              </h1>
            </div>
            <div style="padding: 28px 24px;">
              <p style="color: #44403c; font-size: 15px; margin: 0 0 16px;">
                Hola ${nombreCliente},
              </p>
              <p style="color: #57534e; font-size: 14px; line-height: 1.6; margin: 0 0 20px;">
                Notamos que dejaste estos productos esperándote en tu carrito. ¡Todavía están disponibles!
              </p>
              <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
                ${filasProductosHtml}
              </table>
              <div style="text-align: center; margin: 28px 0 8px;">
                <a href="${frontendUrl}"
                   style="background-color: #b45309; color: #ffffff; text-decoration: none; padding: 12px 32px; border-radius: 999px; font-size: 14px; display: inline-block;">
                  Volver a la tienda
                </a>
              </div>
              <p style="color: #a8a29e; font-size: 12px; text-align: center; margin: 20px 0 0;">
                Completá tu compra antes de que se agoten.
              </p>
            </div>
          </div>
        </div>
      `;

      const enviado = await this.emailService.enviar(
        carrito.usuario?.email || '',
        '¡No te olvides de tu carrito en Belissa Joyas!',
        contenido,
        html,
      );

      await this.notificacionService.registrar({
        id_usuario: carrito.id_usuario,
        id_carrito: carrito.id_carrito,
        tipo: TipoNotificacion.CARRITO_ABANDONADO,
        contenido,
        estado_entrega: enviado ? EstadoNotificacion.ENVIADO : EstadoNotificacion.FALLIDO,
      });
      await this.carritoRepo.update(carrito.id_carrito, { estado: EstadoCarrito.ABANDONADO });
    }
  }

  // Corre el día 1 de cada mes a las 3:00 AM.
  // Recalcula el nivel VIP de todos los clientes registrados, capturando
  // tanto ascensos como descensos por vencimiento de la ventana móvil de 12 meses.
  @Cron('0 3 1 * *')
  async recalcularNivelesVip() {
    this.logger.log('Iniciando recálculo mensual de niveles VIP');
    await this.clienteVipService.recalcularTodos();
    this.logger.log('Recálculo mensual de niveles VIP finalizado');
  }
}
