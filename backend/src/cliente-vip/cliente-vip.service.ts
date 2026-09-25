// backend/src/cliente-vip/cliente-vip.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Raw } from 'typeorm';
import { ClienteVip } from './cliente-vip.entity.js';
import { NivelVip } from '../nivel-vip/nivel-vip.entity.js';
import { Venta, EstadoCompra } from '../venta/venta.entity.js';
import { NotificacionService } from '../notificacion/notificacion.service.js';
import { EmailService } from '../email/email.service.js';
import { TipoNotificacion, EstadoNotificacion } from '../notificacion/notificacion.entity.js';
import { Usuario } from '../usuario/usuario.entity.js';

@Injectable()
export class ClienteVipService {
  private readonly logger = new Logger(ClienteVipService.name);

  constructor(
    @InjectRepository(ClienteVip)
    private readonly clienteVipRepo: Repository<ClienteVip>,
    @InjectRepository(NivelVip)
    private readonly nivelVipRepo: Repository<NivelVip>,
    @InjectRepository(Venta)
    private readonly ventaRepo: Repository<Venta>,
    @InjectRepository(Usuario)
    private readonly usuarioRepo: Repository<Usuario>,
    private readonly notificacionService: NotificacionService,
    private readonly emailService: EmailService,
  ) {}

  private async calcularMetricas(id_usuario: number) {
    const ventas = await this.ventaRepo.find({
      where: {
        id_usuario,
        estado_compra: EstadoCompra.CONFIRMADA,
        fecha_compra: Raw(() => `"Venta"."fecha_compra" > NOW() - INTERVAL '12 months'`),
      },
    });

    const cantidad_compras = ventas.length;
    const monto_acumulado = ventas.reduce((acc, v) => acc + Number(v.precio_total), 0);

    return { cantidad_compras, monto_acumulado };
  }

  private async determinarNivel(cantidad_compras: number, monto_acumulado: number): Promise<NivelVip> {
    const niveles = await this.nivelVipRepo.find({ order: { monto_min_requerido: 'DESC' } });

    for (const nivel of niveles) {
      const cumpleMonto = monto_acumulado >= Number(nivel.monto_min_requerido);
      const cumpleCantidad = cantidad_compras >= nivel.cantidad_compras_min_requerida;
      if (cumpleMonto && cumpleCantidad) {
        return nivel;
      }
    }

    return niveles[niveles.length - 1];
  }

  async recalcularNivel(id_usuario: number) {
    const { cantidad_compras, monto_acumulado } = await this.calcularMetricas(id_usuario);
    const nivelNuevo = await this.determinarNivel(cantidad_compras, monto_acumulado);

    let clienteVip = await this.clienteVipRepo.findOne({ where: { id_usuario } });
    const nivelAnteriorId = clienteVip?.id_nivel_vip;

    if (!clienteVip) {
      clienteVip = this.clienteVipRepo.create({
        id_usuario,
        id_nivel_vip: nivelNuevo.id_nivel_vip,
        monto_acumulado,
        fecha_categorizacion: new Date(),
      });
    } else {
      clienteVip.id_nivel_vip = nivelNuevo.id_nivel_vip;
      clienteVip.monto_acumulado = monto_acumulado;
    }
    await this.clienteVipRepo.save(clienteVip);

    if (nivelAnteriorId !== nivelNuevo.id_nivel_vip) {
      await this.notificarCambioNivel(id_usuario, nivelNuevo, nivelAnteriorId !== undefined);
    }

    return clienteVip;
  }

  private async notificarCambioNivel(id_usuario: number, nivelNuevo: NivelVip, esRecalculo: boolean) {
    const usuario = await this.usuarioRepo.findOneBy({ id_usuario });
    if (!usuario) return;

    const contenido = `Hola ${usuario.nombre},

${esRecalculo ? 'Tu nivel de fidelidad cambió' : '¡Bienvenido/a a nuestro programa de fidelidad!'} Ahora sos nivel ${nivelNuevo.nombre_nivel} en Belissa Joyas.

Beneficios de tu nuevo nivel:
${nivelNuevo.beneficios || `${nivelNuevo.porcentaje_descuento}% de descuento en tus compras`}

¡Gracias por elegirnos!`;

    const enviado = await this.emailService.enviar(
      usuario.email,
      `¡Ahora sos nivel ${nivelNuevo.nombre_nivel} en Belissa Joyas!`,
      contenido,
    );

    await this.notificacionService.registrar({
      id_usuario,
      tipo: TipoNotificacion.SUBIDA_NIVEL_VIP,
      contenido,
      estado_entrega: enviado ? EstadoNotificacion.ENVIADO : EstadoNotificacion.FALLIDO,
    });
  }

  async recalcularTodos() {
    const todos = await this.clienteVipRepo.find();
    this.logger.log(`Recalculando nivel VIP de ${todos.length} clientes`);
    for (const cliente of todos) {
      await this.recalcularNivel(cliente.id_usuario);
    }
  }

  async obtenerPorUsuario(id_usuario: number) {
    return this.clienteVipRepo.findOne({
      where: { id_usuario },
      relations: { nivel: true },
    });
  }

  // Devuelve el nivel actual del usuario junto con su progreso hacia el
  // próximo nivel, calculado en vivo (no depende de que ya se haya
  // guardado en cliente_vip), para mostrarlo en el panel del cliente.
  async obtenerProgreso(id_usuario: number) {
    const { cantidad_compras, monto_acumulado } = await this.calcularMetricas(id_usuario);
    const niveles = await this.nivelVipRepo.find({ order: { monto_min_requerido: 'ASC' } });

    const nivelActual = await this.determinarNivel(cantidad_compras, monto_acumulado);
    const indiceActual = niveles.findIndex(
      (n) => n.id_nivel_vip === nivelActual.id_nivel_vip,
    );
    const proximoNivel = niveles[indiceActual + 1] || null;

    let progreso: {
      falta_monto: number;
      falta_compras: number;
    } | null = null;

    if (proximoNivel) {
      progreso = {
        falta_monto: Math.max(
          0,
          Number(proximoNivel.monto_min_requerido) - monto_acumulado,
        ),
        falta_compras: Math.max(
          0,
          proximoNivel.cantidad_compras_min_requerida - cantidad_compras,
        ),
      };
    }

    return {
      nivel_actual: nivelActual,
      monto_acumulado,
      cantidad_compras,
      proximo_nivel: proximoNivel,
      progreso,
    };
  }
}
