import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Categoria } from '../categoria/categoria.entity';
import { EstadoGeneral } from '../categoria/categoria.entity';

@Entity('subcategoria')
export class Subcategoria {
  @PrimaryGeneratedColumn()
  id_subcategoria: number;

  @Column()
  id_categoria: number;

  @Column({ length: 100 })
  nombre: string;

  @Column({ type: 'text', nullable: true })
  descripcion: string;

  @Column({ type: 'enum', enum: EstadoGeneral, default: EstadoGeneral.ACTIVA })
  estado: EstadoGeneral;

  @ManyToOne(() => Categoria)
  @JoinColumn({ name: 'id_categoria' })
  categoria: Categoria;
}