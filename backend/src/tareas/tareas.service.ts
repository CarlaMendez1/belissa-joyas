import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import {  Raw, Repository } from 'typeorm';
import { Carrito, EstadoCarrito } from '../carrito/carrito.entity.js';
import { ItemCarrito } from '../item-carrito/item-carrito.entity.js';
import { ConfiguracionService } from '../configuracion/configuracion.service.js';
import { NotificacionService } from '../notificacion/notificacion.service.js';
import { TipoNotificacion, EstadoNotificacion } from '../notificacion/notificacion.entity.js';
import { EmailService } from '../email/email.service.js';

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
  ) {}


  // Corre cada 30 segundos
  @Cron('*/10 * * * * *')
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

      const listaProductos = items
        .map((i) => `- ${i.variante?.producto?.nombre || i.variante?.codigo_sku} x${i.cantidad}`)
        .join('\n');

      const contenido = `Hola ${carrito.usuario?.nombre || 'cliente'},

Notamos que dejaste estos productos en tu carrito de Belissa Joyas:

${listaProductos}

¡Todavía están disponibles! Completá tu compra antes de que se agoten.`;

  const enviado = await this.emailService.enviar(
  carrito.usuario?.email || '',
  '¡No te olvides de tu carrito en Belissa Joyas!',
  contenido,
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
}