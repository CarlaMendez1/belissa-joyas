import { Test, TestingModule } from '@nestjs/testing';
import { jest } from '@jest/globals';
import { AuthService } from './auth.service';
import { UsuarioService } from '../usuario/usuario.service';
import { JwtService } from '@nestjs/jwt';
import { ConflictException } from '@nestjs/common';

describe('AuthService - registro()', () => {
  let authService: AuthService;

  const mockUsuarioService = {
    findByEmail: jest.fn(),
    save: jest.fn(),
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
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
  });

  afterEach(() => jest.clearAllMocks());

  it('debe registrar un usuario nuevo y retornar un token', async () => {
    mockUsuarioService.findByEmail.mockResolvedValue(null);
    mockUsuarioService.save.mockResolvedValue({
      id_usuario: 1,
      nombre: 'Carla',
      apellido: 'Mendez',
      email: 'carla@belissa.com',
      rol: 'cliente',
    });

    const result = await authService.registro({
      nombre: 'Carla',
      apellido: 'Mendez',
      email: 'carla@belissa.com',
      password: '123456',
    });

    expect(result).toHaveProperty('access_token');
    expect(result.access_token).toBe('mock-token-jwt');
    expect(result.usuario.email).toBe('carla@belissa.com');
    expect(mockUsuarioService.findByEmail).toHaveBeenCalledWith('carla@belissa.com');
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