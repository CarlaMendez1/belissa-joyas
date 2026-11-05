import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Provincia } from './provincia.entity.js';

@Entity('tarifa_envio')
export class TarifaEnvio {
  @PrimaryGeneratedColumn()
  id_tarifa: number;

  @Column()
  id_provincia: number;

  // numeric llega como string desde PostgreSQL: usar Number(...) al calcular
  @Column({ type: 'numeric', precision: 10, scale: 2 })
  precio: string;

  @Column({ type: 'int', nullable: true })
  plazo_dias: number | null;

  @Column({ default: true })
  activa: boolean;

  @ManyToOne(() => Provincia)
  @JoinColumn({ name: 'id_provincia' })
  provincia: Provincia;
}
