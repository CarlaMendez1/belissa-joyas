import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, ManyToMany, JoinColumn, JoinTable } from 'typeorm';
import { Producto } from '../producto/producto.entity.js';
import { Caracteristica } from '../caracteristica/caracteristica.entity.js';

export enum EstadoVariante { ACTIVA = 'activa', INACTIVA = 'inactiva' }

@Entity('variante')
export class Variante {
  @PrimaryGeneratedColumn()
  id_variante: number;

  @Column()
  id_producto: number;

  @Column({ length: 50, unique: true })
  codigo_sku: string;

  @Column({ type: 'numeric', precision: 10, scale: 2 })
  precio_venta: number;

  @Column({ default: 0 })
  stock_disponible: number;

  @Column({ type: 'enum', enum: EstadoVariante, default: EstadoVariante.ACTIVA })
  estado: EstadoVariante;

  @ManyToOne(() => Producto)
  @JoinColumn({ name: 'id_producto' })
  producto: Producto;

  @ManyToMany(() => Caracteristica)
  @JoinTable({
    name: 'variante_caracteristica',
    joinColumn:        { name: 'id_variante',       referencedColumnName: 'id_variante' },
    inverseJoinColumn: { name: 'id_caracteristica', referencedColumnName: 'id_caracteristica' },
  })
  caracteristicas: Caracteristica[];
}