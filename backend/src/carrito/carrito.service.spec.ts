import { Test, TestingModule } from '@nestjs/testing';
import { CarritoService } from './carrito.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Carrito, EstadoCarrito } from './carrito.entity';
import { ItemCarrito } from '../item-carrito/item-carrito.entity';
import { Variante } from '../variante/variante.entity';
import { ClienteVipService } from '../cliente-vip/cliente-vip.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('CarritoService', () => {
  let service: CarritoService;

  // Mocks de Repositorios
  const mockCarritoRepo = {
    findOne: jest.fn(),
    findOneBy: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
  };

  const mockItemRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
  };

  const mockVarianteRepo = {
    findOneBy: jest.fn(),
  };

  const mockClienteVipService = {
    obtenerPorUsuario: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CarritoService,
        { provide: getRepositoryToken(Carrito), useValue: mockCarritoRepo },
        { provide: getRepositoryToken(ItemCarrito), useValue: mockItemRepo },
        { provide: getRepositoryToken(Variante), useValue: mockVarianteRepo },
        { provide: ClienteVipService, useValue: mockClienteVipService },
      ],
    }).compile();

    service = module.get<CarritoService>(CarritoService);
    jest.clearAllMocks();
  });

  describe('obtenerCarrito() y lógica de recuperación', () => {
    it('debe devolver un carrito activo existente y aplicar el descuento VIP (10%)', async () => {
      // 1. Simulamos un carrito activo
      mockCarritoRepo.findOne.mockResolvedValue({ id_carrito: 1, id_usuario: 1, precio_subtotal: 1000 });
      // 2. Simulamos que tiene 1 item de $1000
      mockItemRepo.find.mockResolvedValue([{ id_item: 10, cantidad: 1, precio_unitario: 1000, variante: {} }]);
      // 3. Simulamos un cliente VIP Plata con 10% de descuento
      mockClienteVipService.obtenerPorUsuario.mockResolvedValue({ nivel: { nombre_nivel: 'Plata', porcentaje_descuento: 10 } });

      const resultado = await service.obtenerCarrito(1);

      expect(resultado.precio_subtotal).toBe(1000); // El bruto no cambia
      expect(resultado.monto_descuento).toBe(100);  // 10% de 1000
      expect(resultado.total_con_descuento).toBe(900); // 1000 - 100
      expect(resultado.nivel_vip).toBe('Plata');
    });

    it('debe recuperar un carrito ABANDONADO si no hay uno activo', async () => {
      // Retorna null al buscar ACTIVO
      mockCarritoRepo.findOne.mockResolvedValueOnce(null);
      // Retorna un carrito al buscar ABANDONADO
      const carritoAbandonado = { id_carrito: 2, estado: EstadoCarrito.ABANDONADO, precio_subtotal: 0 };
      mockCarritoRepo.findOne.mockResolvedValueOnce(carritoAbandonado);
      
      // Al guardar, simulamos que le cambia el estado
      mockCarritoRepo.save.mockResolvedValue({ ...carritoAbandonado, estado: EstadoCarrito.ACTIVO });
      mockItemRepo.find.mockResolvedValue([]);
      mockClienteVipService.obtenerPorUsuario.mockResolvedValue(null);

      const resultado = await service.obtenerCarrito(1);

      expect(mockCarritoRepo.save).toHaveBeenCalledWith(expect.objectContaining({ estado: EstadoCarrito.ACTIVO }));
      expect(resultado.estado).toBe(EstadoCarrito.ACTIVO);
    });

    it('debe crear un carrito nuevo si no hay ni activo ni abandonado', async () => {
      mockCarritoRepo.findOne.mockResolvedValue(null); // Ni activo ni abandonado
      mockCarritoRepo.save.mockResolvedValue({ id_carrito: 3, id_usuario: 1, precio_subtotal: 0 });
      mockItemRepo.find.mockResolvedValue([]);
      mockClienteVipService.obtenerPorUsuario.mockResolvedValue(null);

      await service.obtenerCarrito(1);

      expect(mockCarritoRepo.save).toHaveBeenCalledWith({ id_usuario: 1 });
    });
  });

  describe('agregarItem()', () => {
    it('debe lanzar NotFoundException si la variante no existe', async () => {
      mockVarianteRepo.findOneBy.mockResolvedValue(null);
      await expect(service.agregarItem(1, { id_variante: 99, cantidad: 1 })).rejects.toThrow(NotFoundException);
    });

    it('debe lanzar BadRequestException si no hay stock suficiente', async () => {
      mockVarianteRepo.findOneBy.mockResolvedValue({ id_variante: 99, stock_disponible: 2 });
      // Intentamos agregar 5, pero hay 2
      await expect(service.agregarItem(1, { id_variante: 99, cantidad: 5 })).rejects.toThrow(BadRequestException);
    });

    it('debe agregar un item nuevo y recalcular el subtotal', async () => {
      // 1. Variante existe con stock 10 y cuesta $500
      mockVarianteRepo.findOneBy.mockResolvedValue({ id_variante: 99, stock_disponible: 10, precio_venta: 500 });
      // 2. Carrito activo existe
      mockCarritoRepo.findOne.mockResolvedValue({ id_carrito: 1 });
      // 3. El item no estaba en el carrito
      mockItemRepo.findOne.mockResolvedValue(null);
      
      // Mocks para el recalcularSubtotal (simulamos que ahora hay 2 unidades en el carrito)
      mockItemRepo.find.mockResolvedValue([{ cantidad: 2, precio_unitario: 500 }]);
      mockCarritoRepo.findOneBy.mockResolvedValue({ id_carrito: 1, precio_subtotal: 1000 });
      mockClienteVipService.obtenerPorUsuario.mockResolvedValue(null);

      const resultado = await service.agregarItem(1, { id_variante: 99, cantidad: 2 });

      expect(mockItemRepo.save).toHaveBeenCalledWith({
        id_carrito: 1,
        id_variante: 99,
        cantidad: 2,
        precio_unitario: 500,
      });
      expect(mockCarritoRepo.update).toHaveBeenCalledWith(1, { precio_subtotal: 1000 });
      expect(resultado.total_con_descuento).toBe(1000); // 2 * 500 sin VIP
    });
  });

  describe('eliminarItem() y vaciarCarrito()', () => {
    it('debe eliminar un item específico y recalcular subtotal', async () => {
      mockCarritoRepo.findOne.mockResolvedValue({ id_carrito: 1 });
      mockItemRepo.find.mockResolvedValue([]); // Quedó vacío
      mockCarritoRepo.findOneBy.mockResolvedValue({ id_carrito: 1, precio_subtotal: 0 });
      mockClienteVipService.obtenerPorUsuario.mockResolvedValue(null);

      await service.eliminarItem(1, 99);

      expect(mockItemRepo.delete).toHaveBeenCalledWith({ id_carrito: 1, id_variante: 99 });
      expect(mockCarritoRepo.update).toHaveBeenCalledWith(1, { precio_subtotal: 0 });
    });

    it('debe vaciar el carrito completamente y poner subtotal en 0', async () => {
      mockCarritoRepo.findOne.mockResolvedValue({ id_carrito: 1 });

      const resultado = await service.vaciarCarrito(1);

      expect(mockItemRepo.delete).toHaveBeenCalledWith({ id_carrito: 1 });
      expect(mockCarritoRepo.update).toHaveBeenCalledWith(1, { precio_subtotal: 0 });
      expect(resultado.mensaje).toBe('Carrito vaciado');
    });
  });
});