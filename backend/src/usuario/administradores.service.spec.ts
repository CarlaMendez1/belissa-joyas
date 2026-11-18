import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { AdministradoresService } from './administradores.service';
import { Usuario, RolUsuario, EstadoUsuario } from './usuario.entity';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { AccionAuditoria } from '../auditoria/log-auditoria.entity';

describe('AdministradoresService', () => {
  let service: AdministradoresService;

  const qb = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getOne: jest.fn(),
  };
  const mockRepo = {
    createQueryBuilder: jest.fn(() => qb),
    find: jest.fn(),
    findOneBy: jest.fn(),
    count: jest.fn(),
    save: jest.fn(async (u) => u),
  };
  const mockAuditoria = { registrar: jest.fn() };
  const mockConfig = { get: jest.fn() };

  const admin = (id: number, extra: Partial<Usuario> = {}) =>
    ({
      id_usuario: id,
      nombre: 'Carla',
      apellido: 'Méndez',
      email: `admin${id}@belissa.com`,
      rol: RolUsuario.ADMINISTRADOR,
      estado: EstadoUsuario.ACTIVO,
      password_hash: 'SECRETO',
      google_id: 'g-123',
      fecha_registro: new Date('2026-01-01'),
      ...extra,
    }) as Usuario;

  const cliente = (extra: Partial<Usuario> = {}) =>
    admin(50, { nombre: 'Mariano', apellido: 'Giménez', email: 'mariano@belissa.com', rol: RolUsuario.CLIENTE, ...extra });

  // El administrador principal es el id 1 (el más antiguo, sin ADMIN_PRINCIPAL_EMAIL)
  const principalEsElPrimero = () => mockRepo.find.mockResolvedValue([admin(1)]);

  beforeEach(async () => {
    jest.clearAllMocks();
    mockConfig.get.mockReturnValue(undefined);
    mockRepo.save.mockImplementation(async (u) => u);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdministradoresService,
        { provide: getRepositoryToken(Usuario), useValue: mockRepo },
        { provide: AuditoriaService, useValue: mockAuditoria },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();
    service = module.get(AdministradoresService);
  });

  describe('idPrincipal()', () => {
    it('usa el administrador del email ADMIN_PRINCIPAL_EMAIL si existe (sin importar mayúsculas)', async () => {
      mockConfig.get.mockReturnValue('  CARLA@Belissa.com ');
      qb.getOne.mockResolvedValue(admin(7));
      expect(await service.idPrincipal()).toBe(7);
      expect(qb.where).toHaveBeenCalledWith('LOWER(u.email) = :email', { email: 'carla@belissa.com' });
    });

    it('si el email configurado no es administrador, cae al más antiguo', async () => {
      mockConfig.get.mockReturnValue('otra@belissa.com');
      qb.getOne.mockResolvedValue(null);
      mockRepo.find.mockResolvedValue([admin(2)]);
      expect(await service.idPrincipal()).toBe(2);
    });

    it('sin variable de entorno toma el administrador más antiguo', async () => {
      principalEsElPrimero();
      expect(await service.idPrincipal()).toBe(1);
      expect(mockRepo.find).toHaveBeenCalledWith(expect.objectContaining({ order: { id_usuario: 'ASC' }, take: 1 }));
    });

    it('devuelve null si no hay administradores', async () => {
      mockRepo.find.mockResolvedValue([]);
      expect(await service.idPrincipal()).toBeNull();
    });
  });

  describe('listar()', () => {
    it('marca al principal e informa si quien consulta puede gestionar', async () => {
      principalEsElPrimero();
      mockRepo.find.mockResolvedValueOnce([admin(1), admin(2)]).mockResolvedValueOnce([admin(1)]);
      const r = await service.listar(1);
      expect(r.puede_gestionar).toBe(true);
      expect(r.administradores.map((a) => a.es_principal)).toEqual([true, false]);
    });

    it('una administradora que no es la principal no puede gestionar', async () => {
      mockRepo.find.mockResolvedValueOnce([admin(1), admin(2)]).mockResolvedValueOnce([admin(1)]);
      expect((await service.listar(2)).puede_gestionar).toBe(false);
    });

    it('nunca expone el hash de la contraseña ni el google_id', async () => {
      mockRepo.find.mockResolvedValueOnce([admin(1)]).mockResolvedValueOnce([admin(1)]);
      const r = await service.listar(1);
      const texto = JSON.stringify(r);
      expect(texto).not.toContain('SECRETO');
      expect(texto).not.toContain('google_id');
      expect(texto).not.toContain('password_hash');
    });
  });

  describe('promover()', () => {
    it('solo el administrador principal puede promover (403)', async () => {
      principalEsElPrimero();
      await expect(service.promover('mariano@belissa.com', 2)).rejects.toThrow(ForbiddenException);
      expect(mockRepo.save).not.toHaveBeenCalled();
    });

    it('exige un email (400)', async () => {
      principalEsElPrimero();
      await expect(service.promover('   ', 1)).rejects.toThrow(BadRequestException);
    });

    it('rechaza un email que no está registrado (404)', async () => {
      principalEsElPrimero();
      qb.getOne.mockResolvedValue(null);
      await expect(service.promover('nadie@belissa.com', 1)).rejects.toThrow(NotFoundException);
    });

    it('rechaza a un usuario inactivo (400)', async () => {
      principalEsElPrimero();
      qb.getOne.mockResolvedValue(cliente({ estado: EstadoUsuario.INACTIVO }));
      await expect(service.promover('mariano@belissa.com', 1)).rejects.toThrow('inactivo');
    });

    it('rechaza a quien ya es administrador (400)', async () => {
      principalEsElPrimero();
      qb.getOne.mockResolvedValue(admin(2));
      await expect(service.promover('admin2@belissa.com', 1)).rejects.toThrow('ya es administrador');
    });

    it('promueve a un cliente, audita el cambio de rol y devuelve datos públicos', async () => {
      principalEsElPrimero();
      qb.getOne.mockResolvedValue(cliente());

      const r = await service.promover(' Mariano@Belissa.com ', 1);

      expect(mockRepo.save).toHaveBeenCalledWith(expect.objectContaining({ rol: RolUsuario.ADMINISTRADOR }));
      expect(mockAuditoria.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          id_usuario: 1,
          accion: AccionAuditoria.EDITAR,
          entidad: 'usuario',
          id_entidad: 50,
          datos_anteriores: { rol: RolUsuario.CLIENTE, email: 'mariano@belissa.com' },
          datos_nuevos: { rol: RolUsuario.ADMINISTRADOR, email: 'mariano@belissa.com' },
        }),
      );
      expect(r).not.toHaveProperty('password_hash');
      expect(r.email).toBe('mariano@belissa.com');
    });
  });

  describe('quitar()', () => {
    it('solo el administrador principal puede quitar (403)', async () => {
      principalEsElPrimero();
      await expect(service.quitar(3, 2)).rejects.toThrow(ForbiddenException);
    });

    it('no puede quitarse el permiso a sí misma (400)', async () => {
      principalEsElPrimero();
      await expect(service.quitar(1, 1)).rejects.toThrow('a vos misma');
    });

    it('rechaza a un usuario que no es administrador (404)', async () => {
      principalEsElPrimero();
      mockRepo.findOneBy.mockResolvedValue(cliente());
      await expect(service.quitar(50, 1)).rejects.toThrow(NotFoundException);
    });

    it('rechaza a un usuario inexistente (404)', async () => {
      principalEsElPrimero();
      mockRepo.findOneBy.mockResolvedValue(null);
      await expect(service.quitar(99, 1)).rejects.toThrow(NotFoundException);
    });

    it('tiene que quedar al menos un administrador (400)', async () => {
      principalEsElPrimero();
      mockRepo.findOneBy.mockResolvedValue(admin(2));
      mockRepo.count.mockResolvedValue(1);
      await expect(service.quitar(2, 1)).rejects.toThrow('al menos un administrador');
      expect(mockRepo.save).not.toHaveBeenCalled();
    });

    it('quita el permiso, vuelve a rol cliente y audita', async () => {
      principalEsElPrimero();
      mockRepo.findOneBy.mockResolvedValue(admin(2));
      mockRepo.count.mockResolvedValue(2);

      await service.quitar(2, 1);

      expect(mockRepo.save).toHaveBeenCalledWith(expect.objectContaining({ rol: RolUsuario.CLIENTE }));
      expect(mockAuditoria.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          id_usuario: 1,
          id_entidad: 2,
          datos_anteriores: { rol: RolUsuario.ADMINISTRADOR, email: 'admin2@belissa.com' },
          datos_nuevos: { rol: RolUsuario.CLIENTE, email: 'admin2@belissa.com' },
        }),
      );
    });
  });
});
