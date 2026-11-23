import { Test, TestingModule } from '@nestjs/testing';
import { PagoService } from './pago.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { EnviosService } from '../envios/envios.service';
import { ClienteVipService } from '../cliente-vip/cliente-vip.service';
import { Carrito, EstadoCarrito } from '../carrito/carrito.entity';
import { ItemCarrito } from '../item-carrito/item-carrito.entity';
import { Variante } from '../variante/variante.entity';
import { Venta, EstadoCompra } from '../venta/venta.entity';
import { DetalleVenta } from '../venta/detalle-venta.entity';
import { Pago, EstadoPago } from './pago.entity';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { EmailService } from '../email/email.service';
import { NotificacionService } from '../notificacion/notificacion.service';

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
    findOne: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    findOneBy: jest.fn(),
    manager: { connection: mockConnection },
  };
  const mockDetalleRepo = { save: jest.fn(), find: jest.fn() };
  const mockEmailService = { enviar: jest.fn() };
  const mockNotificacionService = { registrar: jest.fn() };
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
        {
          provide: EnviosService,
          useValue: {
            buscarPropia: jest.fn(),
            calcularCosto: jest.fn().mockResolvedValue({ costo: 0, envio_gratis: false, plazo_dias: null, detalle: 'Retiro en local' }),
          },
        },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: AuditoriaService, useValue: { registrar: jest.fn().mockResolvedValue({}) } },
        { provide: EmailService, useValue: mockEmailService },
        { provide: NotificacionService, useValue: mockNotificacionService },
      ],
    }).compile();

    service = module.get<PagoService>(PagoService);
    
    // Limpiamos todos los mocks antes de cada prueba
    jest.clearAllMocks();
    mockPaymentGet.mockClear();
    mockEmailService.enviar.mockResolvedValue(true);
    mockNotificacionService.registrar.mockResolvedValue({});
  });

  describe('crearPreferencia()', () => {
    it('debe lanzar NotFoundException si no hay carrito activo', async () => {
      mockCarritoRepo.findOne.mockResolvedValue(null);
      await expect(service.crearPreferencia(1, { tipo_entrega: 'retiro' } as any)).rejects.toThrow(NotFoundException);
    });

    it('debe lanzar BadRequestException si el carrito está vacío', async () => {
      mockCarritoRepo.findOne.mockResolvedValue({ id_carrito: 1 });
      mockItemRepo.find.mockResolvedValue([]);
      await expect(service.crearPreferencia(1, { tipo_entrega: 'retiro' } as any)).rejects.toThrow(BadRequestException);
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

      const resultado = await service.crearPreferencia(1, { tipo_entrega: 'retiro' } as any);

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

    describe('correo de confirmación de compra', () => {
      it('sin descuento ni costo de envío muestra subtotal, envío gratis y retiro en el local', async () => {
        mockPaymentGet.mockResolvedValue({ external_reference: '99', status: 'approved' });
        mockVentaRepo.findOneBy.mockResolvedValue({ id_venta: 99, id_usuario: 1 });
        mockVentaRepo.findOne.mockResolvedValue({
          id_venta: 99, id_usuario: 1, id_carrito: 7, precio_total: '22000', costo_envio: '0', tipo_entrega: 'retiro',
          fecha_compra: new Date('2026-11-22T21:40:00Z'),
          usuario: { nombre: 'Lucía', email: 'lucia@mail.com' },
        });
        mockDetalleRepo.find.mockResolvedValue([
          { id_variante: 10, sku_snapshot: 'COL-1', cantidad: 1, precio_unitario: '22000', variante: { producto: { nombre: 'Collar Luna' } } },
        ]);
        mockItemRepo.find.mockResolvedValue([{ id_variante: 10, cantidad: 1, precio_unitario: '22000' }]);
        mockManager.findOne.mockResolvedValue({ id_venta: 99, stock_descontado: false, id_carrito: 7 });
        mockManager.find.mockResolvedValue([{ id_variante: 10, cantidad: 1 }]);

        await service.procesarWebhook({ type: 'payment', 'data.id': '123' }, {});

        const texto = mockEmailService.enviar.mock.calls[0][2];
        expect(texto).not.toContain('Descuento');
        expect(texto).toContain('Envío: Gratis');
        expect(texto).toContain('Total pagado: $22.000');
        expect(texto).toContain('Entrega: Retiro en el local');
        // 21:40 UTC = 18:40 en Argentina
        expect(texto).toContain('Fecha y hora de la compra: 22/11/2026 18:40 hs');
        expect(mockEmailService.enviar.mock.calls[0][3]).toContain('22/11/2026 18:40 hs');
      });

      const ventaConUsuario = {
        id_venta: 99,
        id_usuario: 1,
        id_carrito: 7,
        precio_total: '19800',
        costo_envio: '5800',
        tipo_entrega: 'domicilio',
        envio_calle: 'Belgrano',
        envio_numero: '123',
        envio_localidad: 'Córdoba',
        envio_provincia: 'Córdoba',
        usuario: { nombre: 'Lucía', email: 'lucia@mail.com' },
      };

      beforeEach(() => {
        mockPaymentGet.mockResolvedValue({ external_reference: '99', status: 'approved' });
        mockVentaRepo.findOneBy.mockResolvedValue({ id_venta: 99, id_usuario: 1 });
        mockVentaRepo.findOne.mockResolvedValue(ventaConUsuario);
        mockDetalleRepo.find.mockResolvedValue([
          { id_variante: 10, sku_snapshot: 'COL-1', cantidad: 1, precio_unitario: '19800', variante: { producto: { nombre: 'Collar Luna' } } },
        ]);
        // Precio de lista $22.000: la clienta es VIP con 10 % de descuento
        mockItemRepo.find.mockResolvedValue([{ id_variante: 10, cantidad: 1, precio_unitario: '22000' }]);
      });

      it('avisa a la clienta con el pedido, la entrega y el total pagado', async () => {
        mockManager.findOne.mockResolvedValue({ id_venta: 99, stock_descontado: false, id_carrito: 1 });
        mockManager.find.mockResolvedValue([{ id_variante: 10, cantidad: 1 }]);

        await service.procesarWebhook({ type: 'payment', 'data.id': '123' }, {});

        expect(mockEmailService.enviar).toHaveBeenCalledTimes(1);
        const [destino, asunto, texto, html] = mockEmailService.enviar.mock.calls[0];
        expect(destino).toBe('lucia@mail.com');
        expect(asunto).toContain('#99');
        expect(texto).toContain('Collar Luna x1: $22.000');
        expect(texto).toContain('Subtotal: $22.000');
        expect(texto).toContain('Descuento VIP (10%): -$2.200');
        expect(texto).toContain('Envío: $5.800');
        expect(texto).toContain('Total pagado: $25.600');
        expect(texto).toContain('Belgrano 123');
        expect(html).toContain('x1 · $22.000');
        expect(html).toContain('Descuento VIP (10%)');
        expect(html).toContain('#3B2F2A');
        expect(mockNotificacionService.registrar).toHaveBeenCalledWith(
          expect.objectContaining({ id_venta: 99, estado_entrega: 'enviado' }),
        );
      });

      it('no repite el correo si el aviso de pago llega duplicado', async () => {
        mockManager.findOne.mockResolvedValue({ id_venta: 99, stock_descontado: true });

        await service.procesarWebhook({ type: 'payment', 'data.id': '123' }, {});

        expect(mockEmailService.enviar).not.toHaveBeenCalled();
      });

      it('no manda correo si el pago es rechazado', async () => {
        mockPaymentGet.mockResolvedValue({ external_reference: '99', status: 'rejected' });
        mockVentaRepo.findOneBy.mockResolvedValue({ id_venta: 99, estado_compra: EstadoCompra.PENDIENTE });

        await service.procesarWebhook({ type: 'payment', 'data.id': '123' }, {});

        expect(mockEmailService.enviar).not.toHaveBeenCalled();
      });

      it('si el correo falla, el pago igual queda confirmado y se recalcula el nivel VIP', async () => {
        mockManager.findOne.mockResolvedValue({ id_venta: 99, stock_descontado: false, id_carrito: 1 });
        mockManager.find.mockResolvedValue([{ id_variante: 10, cantidad: 1 }]);
        mockEmailService.enviar.mockRejectedValue(new Error('Brevo caído'));

        await expect(service.procesarWebhook({ type: 'payment', 'data.id': '123' }, {})).resolves.toEqual({ recibido: true });

        expect(mockClienteVipService.recalcularNivel).toHaveBeenCalledWith(1);
      });
    });
  });
});