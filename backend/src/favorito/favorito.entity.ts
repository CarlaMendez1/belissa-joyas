import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { Usuario } from '../usuario/usuario.entity.js';
import { Producto } from '../producto/producto.entity.js';

@Entity('favorito')
@Unique('uq_favorito_usuario_producto', ['id_usuario', 'id_producto'])
export class Favorito {
  @PrimaryGeneratedColumn()
  id_favorito: number;

  @Column()
  id_usuario: number;

  @Column()
  id_producto: number;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  fecha_alta: Date;

  @ManyToOne(() => Usuario)
  @JoinColumn({ name: 'id_usuario' })
  usuario: Usuario;

  @ManyToOne(() => Producto)
  @JoinColumn({ name: 'id_producto' })
  producto: Producto;
}
