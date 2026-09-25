import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Usuario } from '../usuario/usuario.entity.js';

export enum AccionAuditoria {
  CREAR = 'crear',
  EDITAR = 'editar',
  ELIMINAR = 'eliminar',
}

@Entity('log_auditoria')
export class LogAuditoria {
  @PrimaryGeneratedColumn()
  id_log: number;

  @Column({ nullable: true })
  id_usuario: number;

  @Column({ type: 'enum', enum: AccionAuditoria })
  accion: AccionAuditoria;

  @Column({ length: 50 })
  entidad: string;

  @Column({ nullable: true })
  id_entidad: number;

  @Column({ type: 'jsonb', nullable: true })
  datos_anteriores: any;

  @Column({ type: 'jsonb', nullable: true })
  datos_nuevos: any;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  fecha: Date;

  @ManyToOne(() => Usuario, { nullable: true })
  @JoinColumn({ name: 'id_usuario' })
  usuario: Usuario;
}