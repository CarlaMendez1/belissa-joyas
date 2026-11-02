import { Entity, PrimaryGeneratedColumn, Column, ManyToMany, JoinTable } from 'typeorm';
import { Categoria } from '../categoria/categoria.entity.js';

export type TipoDato = 'texto' | 'numero';

@Entity('opcion')
export class Opcion {
  @PrimaryGeneratedColumn()
  id_opcion: number;

  @Column({ length: 80, unique: true })
  nombre: string;

  // 'texto' | 'numero'. Las reglas viven en la BD (ver backend/sql/01-*.sql)
  @Column({ type: 'varchar', length: 10, default: 'texto' })
  tipo_dato: TipoDato;

  // Obligatoria si tipo_dato = 'numero' (ej: cm, kg); null si es 'texto'
  @Column({ type: 'varchar', length: 20, nullable: true })
  unidad: string | null;

  @ManyToMany(() => Categoria)
  @JoinTable({
    name: 'categoria_opcion',
    joinColumn: { name: 'id_opcion',    referencedColumnName: 'id_opcion' },
    inverseJoinColumn: { name: 'id_categoria', referencedColumnName: 'id_categoria' },
  })
  categorias: Categoria[];
}