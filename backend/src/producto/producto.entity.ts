import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { Subcategoria } from '../subcategoria/subcategoria.entity.js';

export enum EstadoProducto { ACTIVO = 'activo', INACTIVO = 'inactivo' }

@Entity('producto')
export class Producto {
  @PrimaryGeneratedColumn()
  id_producto: number;

  @Column()
  id_subcategoria: number;

  @Column({ length: 50, unique: true })
  codigo_sku: string;

  @Column({ length: 150 })
  nombre: string;

  @Column({ type: 'text', nullable: true })
  descripcion: string;

  @Column({ type: 'jsonb', nullable: true })
  imagenes: string[];

  @Column({ type: 'enum', enum: EstadoProducto, default: EstadoProducto.ACTIVO })
  estado: EstadoProducto;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  fecha_alta: Date;

  @ManyToOne(() => Subcategoria)
  @JoinColumn({ name: 'id_subcategoria' })
  subcategoria: Subcategoria;
}