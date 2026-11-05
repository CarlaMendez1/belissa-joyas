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

  @Column({ default: false })
  stock_descontado: boolean;

  // ---- Envío ----
  // null en las ventas anteriores al módulo de envíos
  @Column({ type: 'varchar', length: 20, nullable: true })
  tipo_entrega: 'domicilio' | 'retiro' | null;

  // Va aparte de precio_total (que son solo los productos) para no inflar el nivel VIP
  @Column({ type: 'numeric', precision: 10, scale: 2, default: 0 })
  costo_envio: string;

  @Column({ type: 'varchar', length: 30, nullable: true })
  estado_envio: string | null;

  @Column({ type: 'int', nullable: true })
  id_direccion: number | null;

  // Copia de la dirección al momento de comprar
  @Column({ type: 'varchar', length: 100, nullable: true })
  envio_destinatario: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  envio_telefono: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  envio_calle: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  envio_numero: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  envio_piso_depto: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  envio_localidad: string | null;

  @Column({ type: 'varchar', length: 60, nullable: true })
  envio_provincia: string | null;

  @Column({ type: 'varchar', length: 10, nullable: true })
  envio_codigo_postal: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  envio_observaciones: string | null;

  @Column({ type: 'varchar', length: 60, nullable: true })
  transportista: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  numero_seguimiento: string | null;

  @Column({ type: 'timestamp', nullable: true })
  fecha_despacho: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  fecha_entrega: Date | null;
}
