import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Usuario } from '../usuario/usuario.entity.js';
import { Provincia } from './provincia.entity.js';

@Entity('direccion_envio')
export class DireccionEnvio {
  @PrimaryGeneratedColumn()
  id_direccion: number;

  @Column()
  id_usuario: number;

  @Column({ length: 100 })
  nombre_destinatario: string;

  @Column({ length: 30 })
  telefono: string;

  @Column({ length: 120 })
  calle: string;

  @Column({ length: 20 })
  numero: string;

  @Column({ type: 'varchar', length: 30, nullable: true })
  piso_depto: string | null;

  @Column({ length: 100 })
  localidad: string;

  @Column()
  id_provincia: number;

  @Column({ length: 10 })
  codigo_postal: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  observaciones: string | null;

  @Column({ default: false })
  es_predeterminada: boolean;

  @Column({ default: true })
  activa: boolean;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  fecha_creacion: Date;

  @ManyToOne(() => Usuario, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_usuario' })
  usuario: Usuario;

  @ManyToOne(() => Provincia)
  @JoinColumn({ name: 'id_provincia' })
  provincia: Provincia;
}
