
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Usuario } from '../usuario/usuario.entity.js';
import { Carrito } from '../carrito/carrito.entity.js';
import { Venta } from '../venta/venta.entity.js';

export enum TipoNotificacion {
  CARRITO_ABANDONADO = 'carrito_abandonado',
  ESTADO_PAGO = 'estado_pago',
  PROMOCION = 'promocion',
  SUBIDA_NIVEL_VIP = 'subida_nivel_vip',
}

export enum EstadoNotificacion {
  PENDIENTE = 'pendiente',
  ENVIADO = 'enviado',
  FALLIDO = 'fallido',
}

@Entity('notificacion')
export class Notificacion {
  @PrimaryGeneratedColumn()
  id_notificacion: number;

  @Column()
  id_usuario: number;

  @Column({ nullable: true })
  id_carrito: number;

  @Column({ nullable: true })
  id_venta: number;

  @Column({ type: 'enum', enum: TipoNotificacion })
  tipo: TipoNotificacion;

  @Column({ type: 'text' })
  contenido: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  fecha_envio: Date;

  @Column({ type: 'enum', enum: EstadoNotificacion, default: EstadoNotificacion.PENDIENTE })
  estado_entrega: EstadoNotificacion;

  @ManyToOne(() => Usuario)
  @JoinColumn({ name: 'id_usuario' })
  usuario: Usuario;

  @ManyToOne(() => Carrito)
  @JoinColumn({ name: 'id_carrito' })
  carrito: Carrito;

  @ManyToOne(() => Venta)
  @JoinColumn({ name: 'id_venta' })
  venta: Venta;
}