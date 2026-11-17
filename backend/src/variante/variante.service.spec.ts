import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { VarianteService } from './variante.service';
import { Variante, EstadoVariante } from './variante.entity';
import { Caracteristica } from '../caracteristica/caracteristica.entity';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { AccionAuditoria } from '../auditoria/log-auditoria.entity';

describe('VarianteService', () => {
  let service: VarianteService;

  // QueryBuilder encadenable que termina en getRawMany
  const qb: any = {};
  ['select', 'from', 'innerJoin', 'where'].forEach((m) => (qb[m] = jest.fn().mockReturnValue(qb)));
  qb.getRawMany = jest.fn();

  const mockRepo = {
    find: jest.fn(),
    findOneBy: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    manager: { createQueryBuilder: jest.fn().mockReturnValue(qb) },
  };
  const mockCaracRepo = { findBy: jest.fn() };
  const mockAuditoria = { registrar: jest.fn() };

  const talle14 = { id_caracteristica: 10, valor: '14' };
  const oro = { id_caracteristica: 11, valor: 'Oro 18k' };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockRepo.manager.createQueryBuilder.mockReturnValue(qb);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VarianteService,
        { provide: getRepositoryToken(Variante), useValue: mockRepo },
        { provide: getRepositoryToken(Caracteristica), useValue: mockCaracRepo },
        { provide: AuditoriaService, useValue: mockAuditoria },
      ],
    }).compile();
    service = module.get(VarianteService);
  });

  describe('findByProducto()', () => {
    it('trae solo variantes activas con sus características', async () => {
      mockRepo.find.mockResolvedValue([{ id_variante: 1 }]);
      const res = await service.findByProducto(1);
      expect(mockRepo.find).toHaveBeenCalledWith({
        where: { id_producto: 1, estado: EstadoVariante.ACTIVA },
        relations: { caracteristicas: true },
      });
      expect(res).toHaveLength(1);
    });
  });

  describe('create()', () => {
    it('crea la variante con SKU VAR-<timestamp>, características y audita', async () => {
      qb.getRawMany.mockResolvedValue([{ id_caracteristica: 10 }, { id_caracteristica: 11 }]);
      mockCaracRepo.findBy.mockResolvedValue([talle14, oro]);
      mockRepo.save.mockImplementation(async (v) => ({ id_variante: 5, ...v }));

      const res = await service.create(
        { id_producto: 1, precio_venta: 48900, stock_disponible: 6, caracteristicas: [10, 11] } as any,
        3,
      );

      expect(res.codigo_sku).toMatch(/^VAR-\d+$/);
      expect(res.caracteristicas).toEqual([talle14, oro]);
      expect(res.stock_disponible).toBe(6);
      expect(mockAuditoria.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          id_usuario: 3,
          accion: AccionAuditoria.CREAR,
          entidad: 'Variante',
          id_entidad: 5,
          datos_nuevos: expect.objectContaining({ precio_venta: 48900, stock_disponible: 6 }),
        }),
      );
    });

    it('usa stock 0 por defecto y no valida si no hay características', async () => {
      mockRepo.save.mockImplementation(async (v) => ({ id_variante: 6, ...v }));
      const res = await service.create({ id_producto: 2, precio_venta: 27500 } as any, 3);

      expect(res.stock_disponible).toBe(0);
      expect(res.caracteristicas).toEqual([]);
      expect(mockRepo.manager.createQueryBuilder).not.toHaveBeenCalled();
      expect(mockCaracRepo.findBy).not.toHaveBeenCalled();
    });

    it('rechaza características de opciones no habilitadas para la categoría', async () => {
      qb.getRawMany.mockResolvedValue([{ id_caracteristica: 10 }]);
      await expect(
        service.create({ id_producto: 1, precio_venta: 100, caracteristicas: [10, 99] } as any, 3),
      ).rejects.toThrow(BadRequestException);
      expect(mockRepo.save).not.toHaveBeenCalled();
      expect(mockAuditoria.registrar).not.toHaveBeenCalled();
    });

    it('el mensaje de error indica las características inválidas', async () => {
      qb.getRawMany.mockResolvedValue([]);
      await expect(
        service.create({ id_producto: 1, precio_venta: 100, caracteristicas: [7, 8] } as any, 3),
      ).rejects.toThrow(/\[7, 8\]/);
    });
  });

  describe('actualizarStock()', () => {
    it('fija el stock (no suma) y audita el valor anterior', async () => {
      mockRepo.findOneBy
        .mockResolvedValueOnce({ id_variante: 1, stock_disponible: 6 })
        .mockResolvedValueOnce({ id_variante: 1, stock_disponible: 2 });

      const res = await service.actualizarStock(1, 2, 3);

      expect(mockRepo.update).toHaveBeenCalledWith(1, { stock_disponible: 2 });
      expect(res.stock_disponible).toBe(2);
      expect(mockAuditoria.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          accion: AccionAuditoria.EDITAR,
          datos_anteriores: { stock_disponible: 6 },
          datos_nuevos: { stock_disponible: 2 },
        }),
      );
    });

    it('lanza NotFoundException si la variante no existe', async () => {
      mockRepo.findOneBy.mockResolvedValue(null);
      await expect(service.actualizarStock(99, 5, 3)).rejects.toThrow(NotFoundException);
      expect(mockRepo.update).not.toHaveBeenCalled();
    });
  });

  describe('update()', () => {
    const base = () => ({ id_variante: 1, id_producto: 1, precio_venta: 48900, stock_disponible: 6, caracteristicas: [] });

    it('cambia precio y stock y audita antes/después', async () => {
      mockRepo.findOneBy.mockResolvedValue(base());
      mockRepo.save.mockImplementation(async (v) => v);

      const res = await service.update(1, { precio_venta: 52000, stock_disponible: 4 }, 3);

      expect(res.precio_venta).toBe(52000);
      expect(mockAuditoria.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          datos_anteriores: { precio_venta: 48900, stock_disponible: 6 },
          datos_nuevos: { precio_venta: 52000, stock_disponible: 4 },
        }),
      );
    });

    it('permite poner stock 0 (no lo trata como ausente)', async () => {
      mockRepo.findOneBy.mockResolvedValue(base());
      mockRepo.save.mockImplementation(async (v) => v);
      const res = await service.update(1, { stock_disponible: 0 }, 3);
      expect(res.stock_disponible).toBe(0);
    });

    it('reemplaza características validadas', async () => {
      mockRepo.findOneBy.mockResolvedValue(base());
      qb.getRawMany.mockResolvedValue([{ id_caracteristica: 11 }]);
      mockCaracRepo.findBy.mockResolvedValue([oro]);
      mockRepo.save.mockImplementation(async (v) => v);

      const res = await service.update(1, { caracteristicas: [11] }, 3);
      expect(res.caracteristicas).toEqual([oro]);
    });

    it('con lista vacía de características las quita sin validar', async () => {
      mockRepo.findOneBy.mockResolvedValue({ ...base(), caracteristicas: [talle14] });
      mockRepo.save.mockImplementation(async (v) => v);

      const res = await service.update(1, { caracteristicas: [] }, 3);
      expect(res.caracteristicas).toEqual([]);
      expect(mockRepo.manager.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('rechaza características inválidas para la categoría del producto', async () => {
      mockRepo.findOneBy.mockResolvedValue(base());
      qb.getRawMany.mockResolvedValue([]);
      await expect(service.update(1, { caracteristicas: [50] }, 3)).rejects.toThrow(BadRequestException);
      expect(mockRepo.save).not.toHaveBeenCalled();
    });

    it('lanza NotFoundException si no existe', async () => {
      mockRepo.findOneBy.mockResolvedValue(null);
      await expect(service.update(99, { precio_venta: 1 }, 3)).rejects.toThrow(NotFoundException);
    });
  });

  describe('agregarImagen()', () => {
    it('agrega la URL al arreglo de imágenes', async () => {
      mockRepo.findOneBy.mockResolvedValue({ id_variante: 1, imagenes: ['a.jpg'] });
      mockRepo.save.mockImplementation(async (v) => v);
      const res = await service.agregarImagen(1, 'b.jpg');
      expect(res.imagenes).toEqual(['a.jpg', 'b.jpg']);
    });

    it('arranca el arreglo si no tenía imágenes', async () => {
      mockRepo.findOneBy.mockResolvedValue({ id_variante: 1, imagenes: null });
      mockRepo.save.mockImplementation(async (v) => v);
      expect((await service.agregarImagen(1, 'b.jpg')).imagenes).toEqual(['b.jpg']);
    });

    it('lanza NotFoundException si no existe', async () => {
      mockRepo.findOneBy.mockResolvedValue(null);
      await expect(service.agregarImagen(99, 'x')).rejects.toThrow(NotFoundException);
    });
  });

  describe('bajaLogica()', () => {
    it('pasa la variante a inactiva y audita', async () => {
      mockRepo.findOneBy.mockResolvedValue({ id_variante: 1, estado: EstadoVariante.INACTIVA });
      const res = await service.bajaLogica(1, 3);

      expect(mockRepo.update).toHaveBeenCalledWith(1, { estado: EstadoVariante.INACTIVA });
      expect(res.estado).toBe(EstadoVariante.INACTIVA);
      expect(mockAuditoria.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          accion: AccionAuditoria.ELIMINAR,
          datos_anteriores: { estado: 'activa' },
          datos_nuevos: { estado: 'inactiva' },
        }),
      );
    });

    it('lanza NotFoundException si no existe', async () => {
      mockRepo.findOneBy.mockResolvedValue(null);
      await expect(service.bajaLogica(99, 3)).rejects.toThrow(NotFoundException);
      expect(mockAuditoria.registrar).not.toHaveBeenCalled();
    });
  });
});
