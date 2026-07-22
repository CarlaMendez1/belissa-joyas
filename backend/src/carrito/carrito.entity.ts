import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, JoinColumn, UpdateDateColumn } from 'typeorm';
import { Usuario } from '../usuario/usuario.entity.js';

export enum EstadoCarrito { ACTIVO = 'activo', ABANDONADO = 'abandonado', CONVERTIDO = 'convertido' }

@Entity('carrito')
export class Carrito {
  @PrimaryGeneratedColumn()
  id_carrito: number;

  @Column()
  id_usuario: number;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  fecha_creacion: Date;

  @UpdateDateColumn()
  fecha_ultima_act: Date;

  @Column({ type: 'numeric', precision: 10, scale: 2, default: 0 })
  precio_subtotal: number;

  @Column({ type: 'enum', enum: EstadoCarrito, default: EstadoCarrito.ACTIVO })
  estado: EstadoCarrito;

  @Column({ default: 60 })
  tiempo_abandono: number;

  @ManyToOne(() => Usuario)
  @JoinColumn({ name: 'id_usuario' })
  usuario: Usuario;
}