import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('provincia')
export class Provincia {
  @PrimaryGeneratedColumn()
  id_provincia: number;

  @Column({ length: 60 })
  nombre: string;
}
