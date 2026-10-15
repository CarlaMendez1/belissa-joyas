import { Test, TestingModule } from '@nestjs/testing';
import { PagoService } from './pago.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { ClienteVipService } from '../cliente-vip/cliente-vip.service';
import { Carrito, EstadoCarrito } from '../carrito/carrito.entity';
import { ItemCarrito } from '../item-carrito/item-carrito.entity';
import { Variante } from '../variante/variante.entity';
import { Venta, EstadoCompra } from '../venta/venta.entity';
import { DetalleVenta } from '../venta/detalle-venta.entity';
import { Pago, EstadoPago } from './pago.entity';
import { BadRequestException, NotFoundException } from '@nestjs/common';

// 1. Mocks de la SDK de Mercado Pago
// Declaramos la función AFUERA para que el test y el servicio compartan la misma instancia
const mockPaymentGet = jest.fn();

jest.mock('mercadopago', () => ({
  MercadoPagoConfig: jest.fn(),
  Preference: jest.fn().mockImplementation(() => ({
    create: jest.fn().mockResolvedValue({ id: 'pref-123', init_point: 'https://mp.com/pay' }),
  })),
  Payment: jest.fn().mockImplementation(() => ({
    get: mockPaymentGet,
  })),
}));

describe('PagoService', () => {
  let service: PagoService;

  // 2. Mock del Manager de Transacciones (El núcleo del bloqueo pesimista)
  const mockManager = {
    findOne: jest.fn(),
    find: jest.fn(),
    update: jest.fn(),
    createQueryBuilder: jest.fn().mockReturnValue({
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ affected: 1 }),
    }),
  };

  const mockConnection = {
    transaction: jest.fn().mockImplementation(async (cb) => cb(mockManager)),
  };

  // 3. Mocks de Repositorios
  const mockCarritoRepo = { findOne: jest.fn() };
  const mockItemRepo = { find: jest.fn() };
  const mockVarianteRepo = {};
  const mockVentaRepo = {
    save: jest.fn(),
    update: jest.fn(),
    findOneBy: jest.fn(),
    manager: { connection: mockConnection },
  };
  const mockDetalleRepo = { save: jest.fn() };
  const mockPagoRepo = {
    save: jest.fn(),
    createQueryBuilder: jest.fn().mockReturnValue({
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ affected: 1 }),
    }),
  };

  const mockClienteVipService = {
    obtenerPorUsuario: jest.fn(),
    recalcularNivel: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key) => {
      const envs: Record<string, string> = {
        MP_ACCESS_TOKEN: 'test-token',
        FRONTEND_URL: 'http://localhost:3000',
        BACKEND_PUBLIC_URL: 'http://localhost:4000',
      };
      return envs[key];
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PagoService,
        { provide: getRepositoryToken(Carrito), useValue: mockCarritoRepo },
        { provide: getRepositoryToken(ItemCarrito), useValue: mockItemRepo },
        { provide: getRepositoryToken(Variante), useValue: mockVarianteRepo },
        { provide: getRepositoryToken(Venta), useValue: mockVentaRepo },
        { provide: getRepositoryToken(DetalleVenta), useValue: mockDetalleRepo },
        { provide: getRepositoryToken(Pago), useValue: mockPagoRepo },
        { provide: ClienteVipService, useValue: mockClienteVipService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<PagoService>(PagoService);
    
    // Limpiamos todos los mocks antes de cada prueba
    jest.clearAllMocks();
    mockPaymentGet.mockClear(); 
  });

  describe('crearPreferencia()', () => {
    it('debe lanzar NotFoundException si no hay carrito activo', async () => {
      mockCarritoRepo.findOne.mockResolvedValue(null);
      await expect(service.crearPreferencia(1)).rejects.toThrow(NotFoundException);
    });

    it('debe lanzar BadRequestException si el carrito está vacío', async () => {
      mockCarritoRepo.findOne.mockResolvedValue({ id_carrito: 1 });
      mockItemRepo.find.mockResolvedValue([]);
      await expect(service.crearPreferencia(1)).rejects.toThrow(BadRequestException);
    });

    it('debe aplicar descuento VIP, guardar la venta y retornar la URL de pago', async () => {
      mockCarritoRepo.findOne.mockResolvedValue({ id_carrito: 1 });
      mockItemRepo.find.mockResolvedValue([
        { id_variante: 10, cantidad: 2, precio_unitario: '100', variante: { codigo_sku: 'SKU1' } },
      ]);
      mockClienteVipService.obtenerPorUsuario.mockResolvedValue({
        nivel: { porcentaje_descuento: 10 },
      });
      mockVentaRepo.save.mockResolvedValue({ id_venta: 99, precio_total: 180 });

      const resultado = await service.crearPreferencia(1);

      expect(mockVentaRepo.save).toHaveBeenCalledWith(expect.objectContaining({ precio_total: 180 }));
      expect(mockDetalleRepo.save).toHaveBeenCalledTimes(1);
      expect(resultado).toEqual({ init_point: 'https://mp.com/pay', id_venta: 99 });
    });
  });

  describe('procesarWebhook()', () => {
    it('debe ignorar eventos que no sean de tipo payment', async () => {
      const resultado = await service.procesarWebhook({ type: 'merchant_order' }, {});
      expect(resultado).toEqual({ recibido: true });
      expect(mockPaymentGet).not.toHaveBeenCalled();
    });

    it('debe cancelar la venta si el pago es rechazado', async () => {
      mockPaymentGet.mockResolvedValue({ external_reference: '99', status: 'rejected' });

      await service.procesarWebhook({ type: 'payment', 'data.id': '123' }, {});

      expect(mockVentaRepo.update).toHaveBeenCalledWith(99, { estado_compra: EstadoCompra.CANCELADA });
    });

    it('CAMINO FELIZ: debe aprobar, descontar stock de forma atómica y recalcular VIP', async () => {
      mockPaymentGet.mockResolvedValue({ external_reference: '99', status: 'approved' });
      mockManager.findOne.mockResolvedValue({ id_venta: 99, stock_descontado: false, id_carrito: 1 });
      mockManager.find.mockResolvedValue([{ id_variante: 10, cantidad: 2 }]);
      mockVentaRepo.findOneBy.mockResolvedValue({ id_venta: 99, id_usuario: 1 });

      await service.procesarWebhook({ type: 'payment', 'data.id': '123' }, {});

      expect(mockManager.update).toHaveBeenCalledWith(
        Venta,
        { id_venta: 99 },
        { estado_compra: EstadoCompra.CONFIRMADA, stock_descontado: true }
      );
      expect(mockClienteVipService.recalcularNivel).toHaveBeenCalledWith(1);
    });

    it('BARRERA DE CONCURRENCIA: debe detener hilos duplicados si el stock ya fue descontado', async () => {
      mockPaymentGet.mockResolvedValue({ external_reference: '99', status: 'approved' });
      // Simulamos que la base de datos detectó el pago bloqueado previamente
      mockManager.findOne.mockResolvedValue({ id_venta: 99, stock_descontado: true });

      await service.procesarWebhook({ type: 'payment', 'data.id': '123' }, {});

      expect(mockManager.createQueryBuilder).not.toHaveBeenCalled();
      expect(mockManager.update).not.toHaveBeenCalledWith(
        Venta,
        expect.anything(),
        expect.objectContaining({ stock_descontado: true })
      );
      expect(mockClienteVipService.recalcularNivel).not.toHaveBeenCalled();
    });
  });
});