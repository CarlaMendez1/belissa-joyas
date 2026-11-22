import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException } from '@nestjs/common';
import { CarruselService, MAX_CARRUSEL } from './carrusel.service';
import { CarruselInicio } from './carrusel.entity';
import { ProductoService } from '../producto/producto.service';
import { AuditoriaService } from '../auditoria/auditoria.service';

describe('CarruselService', () => {
  let service: CarruselService;

  const tx = { delete: jest.fn(), insert: jest.fn() };
  const repo = {
    find: jest.fn(),
    manager: { transaction: jest.fn((fn: any) => fn(tx)) },
  };
  const productoService = { findAll: jest.fn() };
  const auditoria = { registrar: jest.fn() };

  const activos = [1, 2, 3, 4, 5, 6, 7, 8].map((id) => ({ id_producto: id, nombre: `P${id}` }));

  beforeEach(async () => {
    jest.clearAllMocks();
    productoService.findAll.mockResolvedValue(activos);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CarruselService,
        { provide: getRepositoryToken(CarruselInicio), useValue: repo },
        { provide: ProductoService, useValue: productoService },
        { provide: AuditoriaService, useValue: auditoria },
      ],
    }).compile();
    service = module.get(CarruselService);
  });

  describe('listar', () => {
    it('devuelve los productos en el orden guardado', async () => {
      repo.find.mockResolvedValue([
        { id_producto: 3, posicion: 1 },
        { id_producto: 1, posicion: 2 },
      ]);
      const res = await service.listar();
      expect(res.map((p: any) => p.id_producto)).toEqual([3, 1]);
    });

    it('omite los productos que ya no están activos', async () => {
      repo.find.mockResolvedValue([
        { id_producto: 99, posicion: 1 },
        { id_producto: 2, posicion: 2 },
      ]);
      const res = await service.listar();
      expect(res.map((p: any) => p.id_producto)).toEqual([2]);
    });

    it('devuelve lista vacía sin consultar productos si no hay nada guardado', async () => {
      repo.find.mockResolvedValue([]);
      expect(await service.listar()).toEqual([]);
      expect(productoService.findAll).not.toHaveBeenCalled();
    });
  });

  describe('guardar', () => {
    it('reemplaza el carrusel con las posiciones según el orden recibido y audita', async () => {
      repo.find.mockResolvedValueOnce([{ id_producto: 1, posicion: 1 }]).mockResolvedValue([
        { id_producto: 3, posicion: 1 },
        { id_producto: 2, posicion: 2 },
      ]);
      await service.guardar([3, 2], 10);
      expect(tx.delete).toHaveBeenCalledWith(CarruselInicio, {});
      expect(tx.insert).toHaveBeenCalledWith(CarruselInicio, [
        { id_producto: 3, posicion: 1 },
        { id_producto: 2, posicion: 2 },
      ]);
      expect(auditoria.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          id_usuario: 10,
          entidad: 'CarruselInicio',
          datos_anteriores: { productos: [1] },
          datos_nuevos: { productos: [3, 2] },
        }),
      );
    });

    it('permite vaciar el carrusel', async () => {
      repo.find.mockResolvedValue([]);
      await service.guardar([], 10);
      expect(tx.delete).toHaveBeenCalled();
      expect(tx.insert).not.toHaveBeenCalled();
    });

    it('rechaza más productos que el máximo', async () => {
      const ids = Array.from({ length: MAX_CARRUSEL + 1 }, (_, i) => i + 1);
      await expect(service.guardar(ids)).rejects.toThrow(BadRequestException);
      expect(repo.manager.transaction).not.toHaveBeenCalled();
    });

    it('rechaza productos repetidos', async () => {
      await expect(service.guardar([1, 1])).rejects.toThrow(BadRequestException);
    });

    it('rechaza productos inexistentes o inactivos', async () => {
      await expect(service.guardar([1, 99])).rejects.toThrow(/99/);
      expect(repo.manager.transaction).not.toHaveBeenCalled();
    });
  });
});
