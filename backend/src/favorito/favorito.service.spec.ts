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
    manager: { query: jest.fn() },
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
    it('devuelve solo productos activos con precio, disponibilidad y características', async () => {
      favoritoRepo.find.mockResolvedValue([
        { id_producto: 2, fecha_alta: new Date('2026-11-02'), producto: { id_producto: 2, nombre: 'Anillo', codigo_sku: 'AN-1', descripcion: 'Anillo de compromiso', imagenes: ['a.jpg'], estado: EstadoProducto.ACTIVO } },
        { id_producto: 3, fecha_alta: new Date('2026-11-01'), producto: { id_producto: 3, nombre: 'Collar', codigo_sku: 'CO-1', imagenes: [], estado: EstadoProducto.INACTIVO } },
      ]);
      favoritoRepo.manager.query
        .mockResolvedValueOnce([{ id_producto: 2, precio_desde: '48900.00', precios_distintos: '2', stock_total: '5' }])
        .mockResolvedValueOnce([
          { id_producto: 2, opcion: 'Material', unidad: null, valor: 'Oro 18k' },
          { id_producto: 2, opcion: 'Material', unidad: null, valor: 'Plata' },
          { id_producto: 2, opcion: 'Largo', unidad: 'cm', valor: '45' },
        ]);
      const res = await service.listar(1);
      expect(res).toHaveLength(1);
      expect(res[0]).toMatchObject({
        id_producto: 2,
        nombre: 'Anillo',
        descripcion: 'Anillo de compromiso',
        precio_desde: 48900,
        varios_precios: true,
        disponible: true,
        especificaciones: [
          { opcion: 'Material', valores: ['Oro 18k', 'Plata'] },
          { opcion: 'Largo', valores: ['45 cm'] },
        ],
      });
    });

    it('marca como no disponible un producto sin stock', async () => {
      favoritoRepo.find.mockResolvedValue([
        { id_producto: 2, fecha_alta: new Date(), producto: { id_producto: 2, nombre: 'Anillo', codigo_sku: 'AN-1', estado: EstadoProducto.ACTIVO } },
      ]);
      favoritoRepo.manager.query
        .mockResolvedValueOnce([{ id_producto: 2, precio_desde: '1000', precios_distintos: '1', stock_total: '0' }])
        .mockResolvedValueOnce([]);
      const res = await service.listar(1);
      expect(res[0].disponible).toBe(false);
      expect(res[0].varios_precios).toBe(false);
    });

    it('con lista vacía no consulta variantes', async () => {
      favoritoRepo.find.mockResolvedValue([]);
      expect(await service.listar(1)).toEqual([]);
      expect(favoritoRepo.manager.query).not.toHaveBeenCalled();
    });
  });

  describe('ids', () => {
    it('devuelve los ids de producto marcados', async () => {
      favoritoRepo.find.mockResolvedValue([{ id_producto: 2 }, { id_producto: 7 }]);
      expect(await service.ids(1)).toEqual([2, 7]);
    });
  });
});
