import { Injectable, ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsuarioService } from '../usuario/usuario.service';
import { RegistroDto } from './dto/registro.dto';
import { LoginDto } from './dto/login.dto';
import { RolUsuario } from '../usuario/usuario.entity';

@Injectable()
export class AuthService {
  constructor(
    private readonly usuarioService: UsuarioService,
    private readonly jwtService: JwtService,
  ) {}

  async registro(dto: RegistroDto) {
    // Verificar que el email no esté registrado
    const existe = await this.usuarioService.findByEmail(dto.email);
    if (existe) throw new ConflictException('El email ya está registrado');

    // Hashear la contraseña con bcrypt (costo 10 — RNF1)
    const password_hash = await bcrypt.hash(dto.password, 10);

    const usuario = await this.usuarioService.save({
      nombre: dto.nombre,
      apellido: dto.apellido,
      email: dto.email,
      password_hash,
      rol: RolUsuario.CLIENTE,
    });

    return this.generarToken(usuario);
  }

  async login(dto: LoginDto) {
    const usuario = await this.usuarioService.findByEmail(dto.email);
    if (!usuario) throw new UnauthorizedException('Credenciales incorrectas');

    const passwordValido = await bcrypt.compare(dto.password, usuario.password_hash);
    if (!passwordValido) throw new UnauthorizedException('Credenciales incorrectas');

    return this.generarToken(usuario);
  }

  private generarToken(usuario: any) {
    const payload = {
      sub:   usuario.id_usuario,
      email: usuario.email,
      rol:   usuario.rol,
    };
    return {
      access_token: this.jwtService.sign(payload),
      usuario: {
        id:       usuario.id_usuario,
        nombre:   usuario.nombre,
        apellido: usuario.apellido,
        email:    usuario.email,
        rol:      usuario.rol,
      },
    };
  }
}