import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Opcion } from '../opcion/opcion.entity';


@Entity('caracteristica')
export class Caracteristica {
  @PrimaryGeneratedColumn()
  id_caracteristica: number;

  @Column()
  id_opcion: number;

  @Column({ length: 100 })
  valor: string;

  @ManyToOne(() => Opcion)
  @JoinColumn({ name: 'id_opcion' })
  opcion: Opcion;
}