
import { Entity, PrimaryColumn, Column } from 'typeorm';

@Entity('configuracion')
export class Configuracion {
  @PrimaryColumn({ length: 100 })
  clave: string;

  @Column({ length: 255 })
  valor: string;

  @Column({ type: 'text', nullable: true })
  descripcion: string;
}