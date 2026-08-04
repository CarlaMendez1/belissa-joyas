import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Venta } from '../venta/venta.entity.js';

export enum EstadoPago {
  PENDIENTE = 'pendiente',
  APROBADO = 'aprobado',
  RECHAZADO = 'rechazado',
  REEMBOLSADO = 'reembolsado',
}

@Entity('pago')
export class Pago {
  @PrimaryGeneratedColumn()
  id_pago: number;

  @Column()
  id_venta: number;

  @Column()
  id_preferencia_mp: string;

  @Column({ type: 'enum', enum: EstadoPago, default: EstadoPago.PENDIENTE })
  estado_pago: EstadoPago;

  @Column({ type: 'timestamp', nullable: true })
  fecha_pago: Date;

  @Column({ nullable: true })
  medio_pago: string;

  @Column({ type: 'numeric', precision: 10, scale: 2 })
  monto_abonado: number;

  @Column({ nullable: true })
  referencia_compra: string;

  @ManyToOne(() => Venta)
  @JoinColumn({ name: 'id_venta' })
  venta: Venta;
}