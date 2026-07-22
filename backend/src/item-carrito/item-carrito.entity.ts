import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Carrito } from '../carrito/carrito.entity.js';
import { Variante } from '../variante/variante.entity.js';

@Entity('item_carrito')
export class ItemCarrito {
  @PrimaryGeneratedColumn()
  id_item_carrito: number;

  @Column()
  id_carrito: number;

  @Column()
  id_variante: number;

  @Column({ default: 1 })
  cantidad: number;

  @Column({ type: 'numeric', precision: 10, scale: 2 })
  precio_unitario: number;

  @ManyToOne(() => Carrito)
  @JoinColumn({ name: 'id_carrito' })
  carrito: Carrito;

  @ManyToOne(() => Variante)
  @JoinColumn({ name: 'id_variante' })
  variante: Variante;
}