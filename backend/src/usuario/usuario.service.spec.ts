import { Test, TestingModule } from '@nestjs/testing';
import { UsuarioService } from './usuario.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Usuario } from './usuario.entity';

// 1. Creamos un objeto que simula los métodos exactos que usa tu servicio desde TypeORM
const mockUsuarioRepository = {
  find: jest.fn(),
  findOneBy: jest.fn(),
  save: jest.fn(),
};

describe('UsuarioService', () => {
  let service: UsuarioService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsuarioService,
        {
          // 2. Inyectamos el mock en lugar del repositorio real
          provide: getRepositoryToken(Usuario),
          useValue: mockUsuarioRepository,
        },
      ],
    }).compile();

    service = module.get<UsuarioService>(UsuarioService);
    
    // Limpiamos los mocks antes de cada prueba para que no se mezclen resultados
    jest.clearAllMocks();
  });

  it('debería estar definido', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('debería retornar un arreglo de usuarios', async () => {
      const resultadoEsperado = [{ id_usuario: 1, email: 'carla@test.com' }];
      mockUsuarioRepository.find.mockResolvedValue(resultadoEsperado);

      const usuarios = await service.findAll();

      expect(usuarios).toEqual(resultadoEsperado);
      expect(mockUsuarioRepository.find).toHaveBeenCalledTimes(1);
    });
  });

  describe('findById', () => {
    it('debería retornar un usuario si el ID existe', async () => {
      const usuarioEsperado = { id_usuario: 1, nombre: 'Carla' };
      mockUsuarioRepository.findOneBy.mockResolvedValue(usuarioEsperado);

      const usuario = await service.findById(1);

      expect(usuario).toEqual(usuarioEsperado);
      // Verificamos que se llame con el campo exacto de tu entidad
      expect(mockUsuarioRepository.findOneBy).toHaveBeenCalledWith({ id_usuario: 1 });
    });

    it('debería retornar null si el ID no existe', async () => {
      mockUsuarioRepository.findOneBy.mockResolvedValue(null);

      const usuario = await service.findById(999);

      expect(usuario).toBeNull();
      expect(mockUsuarioRepository.findOneBy).toHaveBeenCalledWith({ id_usuario: 999 });
    });
  });

  describe('findByEmail', () => {
    it('debería retornar un usuario si el email existe', async () => {
      const usuarioEsperado = { id_usuario: 1, email: 'carla@test.com' };
      mockUsuarioRepository.findOneBy.mockResolvedValue(usuarioEsperado);

      const usuario = await service.findByEmail('carla@test.com');

      expect(usuario).toEqual(usuarioEsperado);
      expect(mockUsuarioRepository.findOneBy).toHaveBeenCalledWith({ email: 'carla@test.com' });
    });
  });

  describe('save', () => {
    it('debería guardar y retornar el usuario creado/actualizado', async () => {
      const dtoUsuario: Partial<Usuario> = { email: 'nuevo@test.com', nombre: 'Nuevo' };
      const usuarioGuardado = { id_usuario: 2, ...dtoUsuario };
      
      mockUsuarioRepository.save.mockResolvedValue(usuarioGuardado);

      const resultado = await service.save(dtoUsuario);

      expect(resultado).toEqual(usuarioGuardado);
      expect(mockUsuarioRepository.save).toHaveBeenCalledWith(dtoUsuario);
    });
  });
});