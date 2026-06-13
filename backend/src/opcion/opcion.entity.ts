import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('opcion')
export class Opcion {
  @PrimaryGeneratedColumn()
  id_opcion: number;

  @Column({ length: 80, unique: true })
  nombre: string;
}