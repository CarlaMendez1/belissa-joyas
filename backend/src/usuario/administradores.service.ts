import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Usuario, RolUsuario, EstadoUsuario } from './usuario.entity';
import { AuditoriaService } from '../auditoria/auditoria.service.js';
import { AccionAuditoria } from '../auditoria/log-auditoria.entity.js';

// Solo se devuelven datos seguros: la entidad Usuario incluye password_hash y google_id
function publico(u: Usuario) {
  return {
    id_usuario: u.id_usuario,
    nombre: u.nombre,
    apellido: u.apellido,
    email: u.email,
    estado: u.estado,
    fecha_registro: u.fecha_registro,
  };
}

@Injectable()
export class AdministradoresService {
  constructor(
    @InjectRepository(Usuario) private readonly repo: Repository<Usuario>,
    private readonly auditoria: AuditoriaService,
    private readonly config: ConfigService,
  ) {}

  // Administrador principal: el email de ADMIN_PRINCIPAL_EMAIL si está definido;
  // si no, el administrador más antiguo (menor id_usuario).
  async idPrincipal(): Promise<number | null> {
  const email = this.config.get<string>('ADMIN_PRINCIPAL_EMAIL')?.trim().toLowerCase();
    if (email) {
      const u = await this.repo
        .createQueryBuilder('u')
        .where('LOWER(u.email) = :email', { email })
        .andWhere('u.rol = :rol', { rol: RolUsuario.ADMINISTRADOR })
        .getOne();
      if (u) return u.id_usuario;
    }
    const primero = await this.repo.find({
      where: { rol: RolUsuario.ADMINISTRADOR },
      order: { id_usuario: 'ASC' },
      take: 1,
    });
    return primero[0]?.id_usuario ?? null;
  }

  private async exigirPrincipal(idActor: number) {
    if ((await this.idPrincipal()) !== idActor) {
      throw new ForbiddenException('Solo el administrador principal puede agregar o quitar administradores');
    }
  }
  async listar(idActor: number) {
    const admins = await this.repo.find({
      where: { rol: RolUsuario.ADMINISTRADOR },
      order: { nombre: 'ASC', apellido: 'ASC' },
    });
    const principal = await this.idPrincipal();
    return {
      puede_gestionar: principal === idActor,
      administradores: admins.map((a) => ({ ...publico(a), es_principal: a.id_usuario === principal })),
    };
  }

  async promover(emailCrudo: string, idActor: number) {
    await this.exigirPrincipal(idActor);
    const email = (emailCrudo ?? '').trim().toLowerCase();
    if (!email) throw new BadRequestException('Ingresá el email del usuario');

    const usuario = await this.repo
      .createQueryBuilder('u')
      .where('LOWER(u.email) = :email', { email })
      .getOne();

    if (!usuario) {
      throw new NotFoundException('No existe un usuario con ese email. Tiene que registrarse primero en la tienda.');
    }
    if (usuario.estado !== EstadoUsuario.ACTIVO) {
      throw new BadRequestException('El usuario está inactivo');
    }
    if (usuario.rol === RolUsuario.ADMINISTRADOR) {
      throw new BadRequestException('Ese usuario ya es administrador');
    }

    usuario.rol = RolUsuario.ADMINISTRADOR;
    await this.repo.save(usuario);
    await this.auditoria.registrar({
      id_usuario: idActor,
      accion: AccionAuditoria.EDITAR,
      entidad: 'usuario',
      id_entidad: usuario.id_usuario,
      datos_anteriores: { rol: RolUsuario.CLIENTE, email: usuario.email },
      datos_nuevos: { rol: RolUsuario.ADMINISTRADOR, email: usuario.email },
    });
    return publico(usuario);
  }

  async quitar(idUsuario: number, idActor: number) {
    await this.exigirPrincipal(idActor);
    if (idUsuario === idActor) {
      throw new BadRequestException('No podés quitarte el permiso a vos misma');
    }
    const usuario = await this.repo.findOneBy({ id_usuario: idUsuario });
    if (!usuario || usuario.rol !== RolUsuario.ADMINISTRADOR) {
      throw new NotFoundException('Ese usuario no es administrador');
    }
    const cantidad = await this.repo.count({ where: { rol: RolUsuario.ADMINISTRADOR } });
    if (cantidad <= 1) {
      throw new BadRequestException('Tiene que quedar al menos un administrador');
    }

    usuario.rol = RolUsuario.CLIENTE;
    await this.repo.save(usuario);
    await this.auditoria.registrar({
      id_usuario: idActor,
      accion: AccionAuditoria.EDITAR,
      entidad: 'usuario',
      id_entidad: usuario.id_usuario,
      datos_anteriores: { rol: RolUsuario.ADMINISTRADOR, email: usuario.email },
      datos_nuevos: { rol: RolUsuario.CLIENTE, email: usuario.email },
    });
    return publico(usuario);
  }
}
