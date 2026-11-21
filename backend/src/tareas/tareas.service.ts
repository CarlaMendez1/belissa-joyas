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
import { armarCorreoHtml } from '../email/plantilla-email.js';
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

      const html = armarCorreoHtml({
        saludo: `Hola ${nombreCliente},`,
        parrafos: ['Notamos que dejaste estos productos esperándote en tu carrito. ¡Todavía están disponibles!'],
        productos: items.map((i) => ({
          nombre: i.variante?.producto?.nombre || i.variante?.codigo_sku || '',
          cantidad: i.cantidad,
        })),
        boton: { texto: 'Volver a la tienda', url: frontendUrl || '' },
        pie: 'Completá tu compra antes de que se agoten.',
      });

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
