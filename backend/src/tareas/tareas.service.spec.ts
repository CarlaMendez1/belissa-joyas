import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { TareasService } from './tareas.service';
import { Carrito, EstadoCarrito } from '../carrito/carrito.entity';
import { ItemCarrito } from '../item-carrito/item-carrito.entity';
import { ConfiguracionService } from '../configuracion/configuracion.service';
import { NotificacionService } from '../notificacion/notificacion.service';
import { TipoNotificacion, EstadoNotificacion } from '../notificacion/notificacion.entity';
import { EmailService } from '../email/email.service';
import { ClienteVipService } from '../cliente-vip/cliente-vip.service';

describe('TareasService', () => {
  let service: TareasService;

  const mockCarritoRepo = { find: jest.fn(), update: jest.fn() };
  const mockItemRepo = { find: jest.fn() };
  const mockConfiguracion = { findByClave: jest.fn() };
  const mockNotificacion = { registrar: jest.fn() };
  const mockEmail = { enviar: jest.fn() };
  const mockConfigService = { get: jest.fn() };
  const mockClienteVip = { recalcularTodos: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TareasService,
        { provide: getRepositoryToken(Carrito), useValue: mockCarritoRepo },
        { provide: getRepositoryToken(ItemCarrito), useValue: mockItemRepo },
        { provide: ConfiguracionService, useValue: mockConfiguracion },
        { provide: NotificacionService, useValue: mockNotificacion },
        { provide: EmailService, useValue: mockEmail },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: ClienteVipService, useValue: mockClienteVip },
      ],
    }).compile();
    service = module.get(TareasService);
    jest.resetAllMocks();
    mockConfiguracion.findByClave.mockResolvedValue('60');
    mockConfigService.get.mockReturnValue('https://belissa.example.com');
    jest.spyOn((service as any).logger, 'log').mockImplementation(() => undefined);
  });

  describe('detectarCarritosAbandonados()', () => {
    const carrito = {
      id_carrito: 11,
      id_usuario: 3,
      usuario: { nombre: 'Valentina', email: 'valentina.rojas@example.com' },
    };
    const items = [
      { cantidad: 1, variante: { codigo_sku: 'ANI-SOL-14', producto: { nombre: 'Anillo solitario plata 925' } } },
      { cantidad: 2, variante: { codigo_sku: 'COL-COR-45', producto: null } },
    ];

    it('lee el tiempo de abandono desde la configuración', async () => {
      mockCarritoRepo.find.mockResolvedValue([]);
      await service.detectarCarritosAbandonados();
      expect(mockConfiguracion.findByClave).toHaveBeenCalledWith('tiempo_abandono_carrito_minutos');
      expect(mockCarritoRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ estado: EstadoCarrito.ACTIVO }) }),
      );
    });

    it('sin carritos vencidos no envía mails ni notificaciones', async () => {
      mockCarritoRepo.find.mockResolvedValue([]);
      await service.detectarCarritosAbandonados();
      expect(mockEmail.enviar).not.toHaveBeenCalled();
      expect(mockNotificacion.registrar).not.toHaveBeenCalled();
    });

    it('un carrito vencido sin ítems se marca abandonado sin avisar', async () => {
      mockCarritoRepo.find.mockResolvedValue([carrito]);
      mockItemRepo.find.mockResolvedValue([]);

      await service.detectarCarritosAbandonados();

      expect(mockCarritoRepo.update).toHaveBeenCalledWith(11, { estado: EstadoCarrito.ABANDONADO });
      expect(mockEmail.enviar).not.toHaveBeenCalled();
      expect(mockNotificacion.registrar).not.toHaveBeenCalled();
    });

    it('un carrito vencido con ítems envía el mail, registra la notificación como enviada y lo marca abandonado', async () => {
      mockCarritoRepo.find.mockResolvedValue([carrito]);
      mockItemRepo.find.mockResolvedValue(items);
      mockEmail.enviar.mockResolvedValue(true);

      await service.detectarCarritosAbandonados();

      const [para, asunto, texto, html] = mockEmail.enviar.mock.calls[0];
      expect(para).toBe('valentina.rojas@example.com');
      expect(asunto).toContain('carrito');
      expect(texto).toContain('Hola Valentina');
      expect(texto).toContain('- Anillo solitario plata 925 x1');
      expect(texto).toContain('- COL-COR-45 x2'); // sin producto, usa el SKU
      expect(texto).toContain('https://belissa.example.com');
      expect(html).toContain('Volver a la tienda');

      expect(mockNotificacion.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          id_usuario: 3,
          id_carrito: 11,
          tipo: TipoNotificacion.CARRITO_ABANDONADO,
          estado_entrega: EstadoNotificacion.ENVIADO,
        }),
      );
      expect(mockCarritoRepo.update).toHaveBeenCalledWith(11, { estado: EstadoCarrito.ABANDONADO });
    });

    it('si el mail falla, la notificación queda como fallida y el carrito igual se marca abandonado', async () => {
      mockCarritoRepo.find.mockResolvedValue([carrito]);
      mockItemRepo.find.mockResolvedValue(items);
      mockEmail.enviar.mockResolvedValue(false);

      await service.detectarCarritosAbandonados();

      expect(mockNotificacion.registrar).toHaveBeenCalledWith(
        expect.objectContaining({ estado_entrega: EstadoNotificacion.FALLIDO }),
      );
      expect(mockCarritoRepo.update).toHaveBeenCalledWith(11, { estado: EstadoCarrito.ABANDONADO });
    });

    it('procesa varios carritos vencidos en la misma corrida', async () => {
      mockCarritoRepo.find.mockResolvedValue([carrito, { ...carrito, id_carrito: 12, id_usuario: 4 }]);
      mockItemRepo.find.mockResolvedValue(items);
      mockEmail.enviar.mockResolvedValue(true);

      await service.detectarCarritosAbandonados();

      expect(mockEmail.enviar).toHaveBeenCalledTimes(2);
      expect(mockCarritoRepo.update).toHaveBeenCalledTimes(2);
    });

    it('usa "cliente" como nombre y mail vacío si el carrito no trae usuario', async () => {
      mockCarritoRepo.find.mockResolvedValue([{ id_carrito: 13, id_usuario: 5, usuario: null }]);
      mockItemRepo.find.mockResolvedValue(items);
      mockEmail.enviar.mockResolvedValue(false);

      await service.detectarCarritosAbandonados();

      const [para, , texto] = mockEmail.enviar.mock.calls[0];
      expect(para).toBe('');
      expect(texto).toContain('Hola cliente');
    });
  });

  describe('recalcularNivelesVip()', () => {
    it('delega el recálculo mensual en ClienteVipService', async () => {
      mockClienteVip.recalcularTodos.mockResolvedValue(undefined);
      await service.recalcularNivelesVip();
      expect(mockClienteVip.recalcularTodos).toHaveBeenCalledTimes(1);
    });

    it('propaga el error si el recálculo falla', async () => {
      mockClienteVip.recalcularTodos.mockRejectedValue(new Error('fallo de BD'));
      await expect(service.recalcularNivelesVip()).rejects.toThrow('fallo de BD');
    });
  });
});
