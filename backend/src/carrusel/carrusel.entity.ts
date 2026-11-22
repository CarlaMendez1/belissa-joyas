import { Entity, PrimaryColumn, Column } from 'typeorm';

@Entity('carrusel_inicio')
export class CarruselInicio {
  @PrimaryColumn()
  id_producto: number;

  @Column()
  posicion: number;
}
