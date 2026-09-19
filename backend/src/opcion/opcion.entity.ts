import { Entity, PrimaryGeneratedColumn, Column, ManyToMany, JoinTable } from 'typeorm';
import { Categoria } from '../categoria/categoria.entity.js';

@Entity('opcion')
export class Opcion {
  @PrimaryGeneratedColumn()
  id_opcion: number;

  @Column({ length: 80, unique: true })
  nombre: string;

  @ManyToMany(() => Categoria)
  @JoinTable({
    name: 'categoria_opcion',
    joinColumn: { name: 'id_opcion',    referencedColumnName: 'id_opcion' },
    inverseJoinColumn: { name: 'id_categoria', referencedColumnName: 'id_categoria' },
  })
  categorias: Categoria[];
}