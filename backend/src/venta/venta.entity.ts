import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Usuario } from '../usuario/usuario.entity.js';
import { Carrito } from '../carrito/carrito.entity.js';

export enum EstadoCompra {
  PENDIENTE = 'pendiente',
  CONFIRMADA = 'confirmada',
  CANCELADA = 'cancelada',
}

@Entity('venta')
export class Venta {
  @PrimaryGeneratedColumn()
  id_venta: number;

  @Column()
  id_usuario: number;

  @Column({ nullable: true })
  id_carrito: number;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  fecha_compra: Date;

  @Column({ type: 'numeric', precision: 10, scale: 2 })
  precio_total: number;

  @Column({ type: 'enum', enum: EstadoCompra, default: EstadoCompra.PENDIENTE })
  estado_compra: EstadoCompra;

  @Column({ nullable: true })
  metodo_pago: string;

  @ManyToOne(() => Usuario)
  @JoinColumn({ name: 'id_usuario' })
  usuario: Usuario;

  @ManyToOne(() => Carrito)
  @JoinColumn({ name: 'id_carrito' })
  carrito: Carrito;
}