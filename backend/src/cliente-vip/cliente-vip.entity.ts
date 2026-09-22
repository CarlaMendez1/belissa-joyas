import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Usuario } from '../usuario/usuario.entity.js';
import { NivelVip } from '../nivel-vip/nivel-vip.entity.js';

@Entity('cliente_vip')
export class ClienteVip {
  @PrimaryGeneratedColumn()
  id_cliente_vip: number;

  @Column()
  id_usuario: number;

  @Column()
  id_nivel_vip: number;

  @Column({ type: 'numeric', precision: 10, scale: 2 })
  monto_acumulado: number;

  @Column({ type: 'date' })
  fecha_categorizacion: Date;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  fecha_ultima_act: Date;

  @ManyToOne(() => Usuario)
  @JoinColumn({ name: 'id_usuario' })
  usuario: Usuario;

  @ManyToOne(() => NivelVip)
  @JoinColumn({ name: 'id_nivel_vip' })
  nivel: NivelVip;
}