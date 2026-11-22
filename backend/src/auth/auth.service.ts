import { Injectable, ConflictException, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsuarioService } from '../usuario/usuario.service';
import { RegistroDto } from './dto/registro.dto';
import { LoginDto } from './dto/login.dto';
import { RolUsuario } from '../usuario/usuario.entity';
import { EmailService } from '../email/email.service';
import { armarCorreoHtml } from '../email/plantilla-email';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usuarioService: UsuarioService,
    private readonly jwtService: JwtService,
    private readonly emailService: EmailService,
  ) {}

  // Correo de bienvenida al crear la cuenta. Si falla, el registro no se ve afectado.
  private async enviarBienvenida(usuario: { nombre: string; email: string }) {
    try {
      const url = process.env.FRONTEND_URL;
      const contenido = `Hola ${usuario.nombre}, tu cuenta en Belissa Joyas se creó correctamente. Ya podés iniciar sesión, armar tu carrito y comprar. ¡Gracias por elegirnos!`;
      const html = armarCorreoHtml({
        saludo: `Hola ${usuario.nombre},`,
        parrafos: [
          'Tu cuenta en Belissa Joyas se creó correctamente y ya iniciaste sesión.',
          'Ya podés explorar el catálogo, guardar tus favoritos y comprar cuando quieras.',
        ],
        ...(url ? { boton: { texto: 'Ir a la tienda', url } } : {}),
        pie: '¡Gracias por elegirnos!',
      });
      await this.emailService.enviar(usuario.email, '¡Bienvenido/a a Belissa Joyas!', contenido, html);
    } catch (err) {
      this.logger.warn(`No se pudo enviar el correo de bienvenida a ${usuario.email}: ${(err as Error).message}`);
    }
  }

  async registro(dto: RegistroDto) {
    const existe = await this.usuarioService.findByEmail(dto.email);
    if (existe) throw new ConflictException('El email ya está registrado');

    const password_hash = await bcrypt.hash(dto.password, 10);

    const usuario = await this.usuarioService.save({
      nombre: dto.nombre,
      apellido: dto.apellido,
      email: dto.email,
      password_hash,
      rol: RolUsuario.CLIENTE,
    });

    void this.enviarBienvenida(usuario);
    return this.generarToken(usuario);
  }

  async login(dto: LoginDto) {
    const usuario = await this.usuarioService.findByEmail(dto.email);
    if (!usuario) throw new UnauthorizedException('Credenciales incorrectas');

    const passwordValido = await bcrypt.compare(dto.password, usuario.password_hash);
    if (!passwordValido) throw new UnauthorizedException('Credenciales incorrectas');

    return this.generarToken(usuario);
  }

  async loginConGoogle(datos: { email: string; nombre: string; apellido: string; google_id: string }) {
    let usuario = await this.usuarioService.findByEmail(datos.email);

    if (!usuario) {
      usuario = await this.usuarioService.save({
        nombre: datos.nombre,
        apellido: datos.apellido,
        email: datos.email,
        google_id: datos.google_id,
        rol: RolUsuario.CLIENTE,
      });
      void this.enviarBienvenida(usuario);
    } else if (!usuario.google_id) {
      usuario = await this.usuarioService.save({ ...usuario, google_id: datos.google_id });
    }

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
