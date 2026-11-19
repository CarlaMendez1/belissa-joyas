import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { FavoritoService } from './favorito.service';
import { Favorito } from './favorito.entity';
import { Producto, EstadoProducto } from '../producto/producto.entity';

describe('FavoritoService', () => {
  let service: FavoritoService;

  const favoritoRepo = {
    find: jest.fn(),
    findOneBy: jest.fn(),
    create: jest.fn((x) => x),
    save: jest.fn(),
    delete: jest.fn(),
  };
  const productoRepo = { findOneBy: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FavoritoService,
        { provide: getRepositoryToken(Favorito), useValue: favoritoRepo },
        { provide: getRepositoryToken(Producto), useValue: productoRepo },
      ],
    }).compile();
    service = module.get(FavoritoService);
  });

  describe('agregar', () => {
    it('guarda el favorito de un producto activo', async () => {
      productoRepo.findOneBy.mockResolvedValue({ id_producto: 5, estado: EstadoProducto.ACTIVO });
      favoritoRepo.findOneBy.mockResolvedValue(null);
      const res = await service.agregar(1, 5);
      expect(favoritoRepo.save).toHaveBeenCalledWith({ id_usuario: 1, id_producto: 5 });
      expect(res).toEqual({ id_producto: 5, favorito: true });
    });

    it('no duplica un favorito que ya existe', async () => {
      productoRepo.findOneBy.mockResolvedValue({ id_producto: 5, estado: EstadoProducto.ACTIVO });
      favoritoRepo.findOneBy.mockResolvedValue({ id_favorito: 9 });
      const res = await service.agregar(1, 5);
      expect(favoritoRepo.save).not.toHaveBeenCalled();
      expect(res.favorito).toBe(true);
    });

    it('rechaza un producto inexistente', async () => {
      productoRepo.findOneBy.mockResolvedValue(null);
      await expect(service.agregar(1, 99)).rejects.toThrow(NotFoundException);
    });

    it('rechaza un producto inactivo', async () => {
      productoRepo.findOneBy.mockResolvedValue({ id_producto: 5, estado: EstadoProducto.INACTIVO });
      await expect(service.agregar(1, 5)).rejects.toThrow(NotFoundException);
      expect(favoritoRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('quitar', () => {
    it('elimina el favorito del usuario', async () => {
      const res = await service.quitar(1, 5);
      expect(favoritoRepo.delete).toHaveBeenCalledWith({ id_usuario: 1, id_producto: 5 });
      expect(res).toEqual({ id_producto: 5, favorito: false });
    });
  });

  describe('listar', () => {
    it('devuelve solo productos activos con sus datos', async () => {
      favoritoRepo.find.mockResolvedValue([
        { fecha_alta: new Date('2026-11-02'), producto: { id_producto: 2, nombre: 'Anillo', codigo_sku: 'AN-1', imagenes: ['a.jpg'], estado: EstadoProducto.ACTIVO } },
        { fecha_alta: new Date('2026-11-01'), producto: { id_producto: 3, nombre: 'Collar', codigo_sku: 'CO-1', imagenes: [], estado: EstadoProducto.INACTIVO } },
      ]);
      const res = await service.listar(1);
      expect(res).toHaveLength(1);
      expect(res[0]).toMatchObject({ id_producto: 2, nombre: 'Anillo', codigo_sku: 'AN-1' });
    });
  });

  describe('ids', () => {
    it('devuelve los ids de producto marcados', async () => {
      favoritoRepo.find.mockResolvedValue([{ id_producto: 2 }, { id_producto: 7 }]);
      expect(await service.ids(1)).toEqual([2, 7]);
    });
  });
});
