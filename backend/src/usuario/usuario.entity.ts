import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

export enum RolUsuario {
  CLIENTE        = 'cliente',
  ADMINISTRADOR  = 'administrador',
}

export enum EstadoUsuario {
  ACTIVO   = 'activo',
  INACTIVO = 'inactivo',
}

@Entity('usuario')
export class Usuario {
  @PrimaryGeneratedColumn()
  id_usuario: number;

  @Column({ length: 100 })
  nombre: string;

  @Column({ length: 100 })
  apellido: string;

  @Column({ length: 150, unique: true })
  email: string;

  @Column({ length: 255, nullable: true })
  password_hash: string;

  @Column({ length: 255, nullable: true, unique: true })
  google_id: string;

  @Column({ type: 'enum', enum: RolUsuario, default: RolUsuario.CLIENTE })
  rol: RolUsuario;

  @CreateDateColumn()
  fecha_registro: Date;

  @Column({ type: 'enum', enum: EstadoUsuario, default: EstadoUsuario.ACTIVO })
  estado: EstadoUsuario;
}