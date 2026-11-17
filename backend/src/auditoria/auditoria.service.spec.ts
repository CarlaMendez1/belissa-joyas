import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Between, MoreThanOrEqual, LessThanOrEqual } from 'typeorm';
import { AuditoriaService } from './auditoria.service';
import { LogAuditoria, AccionAuditoria } from './log-auditoria.entity';

describe('AuditoriaService', () => {
  let service: AuditoriaService;

  const qb = {
    select: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    getRawMany: jest.fn(),
  };
  const mockRepo = {
    save: jest.fn(),
    findAndCount: jest.fn(),
    createQueryBuilder: jest.fn(() => qb),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AuditoriaService, { provide: getRepositoryToken(LogAuditoria), useValue: mockRepo }],
    }).compile();
    service = module.get(AuditoriaService);
    jest.clearAllMocks();
  });

  describe('registrar()', () => {
    it('guarda el movimiento recibido', async () => {
      const datos = {
        id_usuario: 1,
        accion: AccionAuditoria.CREAR,
        entidad: 'Producto',
        id_entidad: 12,
        datos_nuevos: { nombre: 'Anillo solitario plata 925' },
      };
      mockRepo.save.mockResolvedValue({ id_log: 1, ...datos });
      await expect(service.registrar(datos)).resolves.toMatchObject({ id_log: 1 });
      expect(mockRepo.save).toHaveBeenCalledWith(datos);
    });
  });

  describe('listar()', () => {
    const log = {
      id_log: 5,
      accion: AccionAuditoria.EDITAR,
      entidad: 'TarifaEnvio',
      id_entidad: 3,
      datos_anteriores: { precio: '5800' },
      datos_nuevos: { precio: '6400' },
      fecha: new Date('2026-11-16T14:00:00Z'),
      usuario: { nombre: 'Carla', apellido: 'Méndez', password_hash: 'secreto' },
    };

    it('usa valores por defecto (página 1, 20 por página) y devuelve el nombre del usuario sin datos sensibles', async () => {
      mockRepo.findAndCount.mockResolvedValue([[log], 1]);
      const res = await service.listar();

      expect(mockRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ where: {}, skip: 0, take: 20 }),
      );
      expect(res).toMatchObject({ total: 1, pagina: 1, limite: 20 });
      expect(res.items[0].usuario).toBe('Carla Méndez');
      expect(JSON.stringify(res)).not.toContain('secreto');
    });

    it('devuelve usuario null si el movimiento no tiene usuario', async () => {
      mockRepo.findAndCount.mockResolvedValue([[{ ...log, usuario: null }], 1]);
      const res = await service.listar();
      expect(res.items[0].usuario).toBeNull();
    });

    it('limita el tamaño de página a 100 y corrige página/limite inválidos', async () => {
      mockRepo.findAndCount.mockResolvedValue([[], 0]);
      await service.listar({ limite: 5000, pagina: 3 });
      expect(mockRepo.findAndCount).toHaveBeenLastCalledWith(expect.objectContaining({ skip: 200, take: 100 }));

      await service.listar({ limite: 0, pagina: -4 });
      expect(mockRepo.findAndCount).toHaveBeenLastCalledWith(expect.objectContaining({ skip: 0, take: 1 }));
    });

    it('aplica los filtros de entidad, acción y usuario', async () => {
      mockRepo.findAndCount.mockResolvedValue([[], 0]);
      await service.listar({ entidad: 'TarifaEnvio', accion: AccionAuditoria.EDITAR, id_usuario: 1 });
      expect(mockRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ where: { entidad: 'TarifaEnvio', accion: AccionAuditoria.EDITAR, id_usuario: 1 } }),
      );
    });

    it('filtra por rango de fechas cuando hay desde y hasta', async () => {
      mockRepo.findAndCount.mockResolvedValue([[], 0]);
      const desde = new Date('2026-11-01');
      const hasta = new Date('2026-11-30');
      await service.listar({ desde, hasta });
      const { where } = mockRepo.findAndCount.mock.calls[0][0];
      expect(where.fecha).toEqual(Between(desde, hasta));
    });

    it('filtra solo desde o solo hasta', async () => {
      mockRepo.findAndCount.mockResolvedValue([[], 0]);
      const f = new Date('2026-11-10');
      await service.listar({ desde: f });
      expect(mockRepo.findAndCount.mock.calls[0][0].where.fecha).toEqual(MoreThanOrEqual(f));
      await service.listar({ hasta: f });
      expect(mockRepo.findAndCount.mock.calls[1][0].where.fecha).toEqual(LessThanOrEqual(f));
    });
  });

  describe('entidades()', () => {
    it('devuelve la lista de nombres de entidades con registros', async () => {
      qb.getRawMany.mockResolvedValue([{ entidad: 'Configuracion' }, { entidad: 'TarifaEnvio' }]);
      await expect(service.entidades()).resolves.toEqual(['Configuracion', 'TarifaEnvio']);
      expect(qb.orderBy).toHaveBeenCalledWith('l.entidad', 'ASC');
    });
  });
});
