import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

export enum EstadoGeneral { ACTIVA = 'activa', INACTIVA = 'inactiva' }

@Entity('categoria')
export class Categoria {
  @PrimaryGeneratedColumn()
  id_categoria: number;

  @Column({ length: 100, unique: true })
  nombre: string;

  @Column({ type: 'text', nullable: true })
  descripcion: string;

  @Column({ type: 'enum', enum: EstadoGeneral, default: EstadoGeneral.ACTIVA })
  estado: EstadoGeneral;
}