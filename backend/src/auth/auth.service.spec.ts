import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UsuarioService } from '../usuario/usuario.service';
import { JwtService } from '@nestjs/jwt';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { RolUsuario } from '../usuario/usuario.entity';
import { EmailService } from '../email/email.service';

jest.mock('bcrypt');

describe('AuthService', () => {
  let authService: AuthService;

  const mockUsuarioService = {
    findByEmail: jest.fn(),
    save: jest.fn(),
  };

  const mockEmailService = {
    enviar: jest.fn().mockResolvedValue(true),
  };

  const mockJwtService = {
    sign: jest.fn().mockReturnValue('mock-token-jwt'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsuarioService, useValue: mockUsuarioService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: EmailService, useValue: mockEmailService },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('registro()', () => {
    it('debe registrar un usuario nuevo y retornar un token', async () => {
      mockUsuarioService.findByEmail.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
      mockUsuarioService.save.mockResolvedValue({
        id_usuario: 1,
        nombre: 'Carla',
        apellido: 'Mendez',
        email: 'carla@belissa.com',
        rol: RolUsuario.CLIENTE,
      });

      const result = await authService.registro({
        nombre: 'Carla',
        apellido: 'Mendez',
        email: 'carla@belissa.com',
        password: '123456',
      });

      expect(result.access_token).toBe('mock-token-jwt');
      expect(mockUsuarioService.save).toHaveBeenCalledWith(expect.objectContaining({
        email: 'carla@belissa.com',
        password_hash: 'hashed-password',
      }));
    });

    it('envía un correo de bienvenida al registrarse', async () => {
      mockUsuarioService.findByEmail.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
      mockUsuarioService.save.mockResolvedValue({ id_usuario: 1, nombre: 'Carla', email: 'carla@belissa.com', rol: RolUsuario.CLIENTE });

      await authService.registro({ nombre: 'Carla', apellido: 'Mendez', email: 'carla@belissa.com', password: '123456' });
      await new Promise((r) => setImmediate(r));

      expect(mockEmailService.enviar).toHaveBeenCalledTimes(1);
      expect(mockEmailService.enviar).toHaveBeenCalledWith(
        'carla@belissa.com',
        expect.stringContaining('Belissa Joyas'),
        expect.stringContaining('Carla'),
        expect.stringContaining('#3B2F2A'),
      );
    });

    it('el registro funciona aunque falle el envío del correo de bienvenida', async () => {
      mockUsuarioService.findByEmail.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
      mockUsuarioService.save.mockResolvedValue({ id_usuario: 1, nombre: 'Carla', email: 'carla@belissa.com', rol: RolUsuario.CLIENTE });
      mockEmailService.enviar.mockRejectedValueOnce(new Error('sin servicio'));

      const result = await authService.registro({ nombre: 'Carla', apellido: 'Mendez', email: 'carla@belissa.com', password: '123456' });
      await new Promise((r) => setImmediate(r));

      expect(result.access_token).toBe('mock-token-jwt');
    });

    it('no envía correo de bienvenida si el email ya existe', async () => {
      mockUsuarioService.findByEmail.mockResolvedValue({ id_usuario: 1 });
      await expect(authService.registro({ nombre: 'C', apellido: 'M', email: 'x@y.com', password: '123456' })).rejects.toThrow();
      expect(mockEmailService.enviar).not.toHaveBeenCalled();
    });

    it('debe lanzar ConflictException si el email ya existe', async () => {
      mockUsuarioService.findByEmail.mockResolvedValue({ id_usuario: 1 });

      await expect(authService.registro({
        nombre: 'Carla',
        apellido: 'Mendez',
        email: 'carla@belissa.com',
        password: '123456',
      })).rejects.toThrow(ConflictException);
    });
  });

  describe('login()', () => {
    it('debe retornar un token si las credenciales son correctas', async () => {
      mockUsuarioService.findByEmail.mockResolvedValue({
        id_usuario: 1,
        email: 'carla@belissa.com',
        password_hash: 'hashed-password',
        rol: RolUsuario.CLIENTE,
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await authService.login({
        email: 'carla@belissa.com',
        password: '123456',
      });

      expect(result.access_token).toBe('mock-token-jwt');
      expect(bcrypt.compare).toHaveBeenCalledWith('123456', 'hashed-password');
    });

    it('debe lanzar UnauthorizedException si el email no existe', async () => {
      mockUsuarioService.findByEmail.mockResolvedValue(null);

      await expect(authService.login({
        email: 'inexistente@belissa.com',
        password: '123456',
      })).rejects.toThrow(UnauthorizedException);
    });

    it('debe lanzar UnauthorizedException si la contraseña es incorrecta', async () => {
      mockUsuarioService.findByEmail.mockResolvedValue({
        id_usuario: 1,
        email: 'carla@belissa.com',
        password_hash: 'hashed-password',
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(authService.login({
        email: 'carla@belissa.com',
        password: 'password-equivocado',
      })).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('loginConGoogle()', () => {
    const datosGoogle = {
      email: 'carla@gmail.com',
      nombre: 'Carla',
      apellido: 'Mendez',
      google_id: 'google-12345',
    };

    it('debe crear un usuario nuevo si el email de Google no existe en la base', async () => {
      mockUsuarioService.findByEmail.mockResolvedValue(null);
      mockUsuarioService.save.mockResolvedValue({
        id_usuario: 2,
        ...datosGoogle,
        rol: RolUsuario.CLIENTE,
      });

      const result = await authService.loginConGoogle(datosGoogle);
      await new Promise((r) => setImmediate(r));

      expect(result.access_token).toBe('mock-token-jwt');
      expect(mockUsuarioService.save).toHaveBeenCalledWith(expect.objectContaining({
        google_id: 'google-12345',
      }));
      expect(mockEmailService.enviar).toHaveBeenCalledTimes(1);
    });

    it('debe vincular la cuenta si el email existe pero no tiene google_id', async () => {
      const usuarioExistente = {
        id_usuario: 3,
        email: 'carla@gmail.com',
        nombre: 'Carla',
        rol: RolUsuario.CLIENTE,
      };
      mockUsuarioService.findByEmail.mockResolvedValue(usuarioExistente);
      mockUsuarioService.save.mockResolvedValue({
        ...usuarioExistente,
        google_id: 'google-12345',
      });

      const result = await authService.loginConGoogle(datosGoogle);

      expect(result.access_token).toBe('mock-token-jwt');
      expect(mockUsuarioService.save).toHaveBeenCalledWith(expect.objectContaining({
        google_id: 'google-12345',
      }));
    });

    it('debe simplemente loguear si el usuario ya existe y ya tiene google_id', async () => {
      mockUsuarioService.findByEmail.mockResolvedValue({
        id_usuario: 4,
        email: 'carla@gmail.com',
        google_id: 'google-12345',
        rol: RolUsuario.CLIENTE,
      });

      const result = await authService.loginConGoogle(datosGoogle);

      expect(result.access_token).toBe('mock-token-jwt');
      expect(mockUsuarioService.save).not.toHaveBeenCalled();
    });
  });
});