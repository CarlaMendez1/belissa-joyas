
import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('nivel_vip')
export class NivelVip {
  @PrimaryGeneratedColumn()
  id_nivel_vip: number;

  @Column({ length: 50 })
  nombre_nivel: string;

  @Column({ type: 'numeric', precision: 10, scale: 2 })
  monto_min_requerido: number;

  @Column({ type: 'int' })
  cantidad_compras_min_requerida: number;

  @Column({ type: 'numeric', precision: 5, scale: 2 })
  porcentaje_descuento: number;

  @Column({ type: 'text', nullable: true })
  beneficios: string;
}