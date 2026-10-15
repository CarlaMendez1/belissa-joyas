import { Test, TestingModule } from '@nestjs/testing';
import { ClienteVipService } from './cliente-vip.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ClienteVip } from './cliente-vip.entity';
import { NivelVip } from '../nivel-vip/nivel-vip.entity';
import { Venta } from '../venta/venta.entity';
import { Usuario } from '../usuario/usuario.entity';
import { NotificacionService } from '../notificacion/notificacion.service';
import { EmailService } from '../email/email.service';
import { TipoNotificacion, EstadoNotificacion } from '../notificacion/notificacion.entity';

describe('ClienteVipService', () => {
  let service: ClienteVipService;

  // Datos simulados (Mocks) para la lógica de niveles
  const nivelBronce = { id_nivel_vip: 1, nombre_nivel: 'Bronce', monto_min_requerido: 0, cantidad_compras_min_requerida: 0, porcentaje_descuento: 5 };
  const nivelPlata = { id_nivel_vip: 2, nombre_nivel: 'Plata', monto_min_requerido: 500, cantidad_compras_min_requerida: 3, porcentaje_descuento: 10 };
  const nivelOro = { id_nivel_vip: 3, nombre_nivel: 'Oro', monto_min_requerido: 1000, cantidad_compras_min_requerida: 5, porcentaje_descuento: 15 };

  const mockUsuario = { id_usuario: 1, nombre: 'Carla', email: 'carla@belissa.com' };

  const mockClienteVipRepo = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
  };

  const mockNivelVipRepo = {
    find: jest.fn(),
  };

  const mockVentaRepo = {
    find: jest.fn(),
  };

  const mockUsuarioRepo = {
    findOneBy: jest.fn(),
  };

  const mockNotificacionService = {
    registrar: jest.fn(),
  };

  const mockEmailService = {
    enviar: jest.fn().mockResolvedValue(true),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClienteVipService,
        { provide: getRepositoryToken(ClienteVip), useValue: mockClienteVipRepo },
        { provide: getRepositoryToken(NivelVip), useValue: mockNivelVipRepo },
        { provide: getRepositoryToken(Venta), useValue: mockVentaRepo },
        { provide: getRepositoryToken(Usuario), useValue: mockUsuarioRepo },
        { provide: NotificacionService, useValue: mockNotificacionService },
        { provide: EmailService, useValue: mockEmailService },
      ],
    }).compile();

    service = module.get<ClienteVipService>(ClienteVipService);

    // Simulamos el comportamiento de TypeORM según el 'order' que pide el servicio
    mockNivelVipRepo.find.mockImplementation((options) => {
      if (options?.order?.monto_min_requerido === 'DESC') {
        return Promise.resolve([nivelOro, nivelPlata, nivelBronce]);
      }
      return Promise.resolve([nivelBronce, nivelPlata, nivelOro]); // ASC
    });

    jest.clearAllMocks();
  });

  describe('recalcularNivel() y lógica de métricas', () => {
    it('debe asignar el Nivel Plata a un usuario nuevo que cumple los requisitos', async () => {
      // 3 ventas por un total de 600 (Cumple Plata: 500 monto y 3 compras)
      mockVentaRepo.find.mockResolvedValue([
        { precio_total: 200 }, { precio_total: 200 }, { precio_total: 200 }
      ]);
      mockClienteVipRepo.findOne.mockResolvedValue(null); // Es cliente nuevo
      mockUsuarioRepo.findOneBy.mockResolvedValue(mockUsuario);
      
      const nuevoRegistroVip = { id_usuario: 1, id_nivel_vip: nivelPlata.id_nivel_vip, monto_acumulado: 600 };
      mockClienteVipRepo.create.mockReturnValue(nuevoRegistroVip);
      mockClienteVipRepo.save.mockResolvedValue(nuevoRegistroVip);

      const resultado = await service.recalcularNivel(1);

      expect(mockVentaRepo.find).toHaveBeenCalled();
      expect(mockClienteVipRepo.create).toHaveBeenCalledWith(expect.objectContaining({
        id_usuario: 1,
        id_nivel_vip: nivelPlata.id_nivel_vip,
        monto_acumulado: 600,
      }));
      // Verifica envío de mail por subida de nivel
      expect(mockEmailService.enviar).toHaveBeenCalledWith(
        mockUsuario.email,
        expect.stringContaining('Plata'),
        expect.any(String)
      );
      expect(mockNotificacionService.registrar).toHaveBeenCalledWith(expect.objectContaining({
        tipo: TipoNotificacion.SUBIDA_NIVEL_VIP,
        estado_entrega: EstadoNotificacion.ENVIADO,
      }));
    });

    it('no debe enviar notificaciones si el usuario mantiene su nivel actual', async () => {
      // 1 venta de 100 (No alcanza para Plata, se queda en Bronce)
      mockVentaRepo.find.mockResolvedValue([{ precio_total: 100 }]);
      mockClienteVipRepo.findOne.mockResolvedValue({ id_usuario: 1, id_nivel_vip: nivelBronce.id_nivel_vip });
      
      await service.recalcularNivel(1);

      expect(mockClienteVipRepo.save).toHaveBeenCalledWith(expect.objectContaining({
        id_nivel_vip: nivelBronce.id_nivel_vip,
        monto_acumulado: 100,
      }));
      expect(mockEmailService.enviar).not.toHaveBeenCalled();
      expect(mockNotificacionService.registrar).not.toHaveBeenCalled();
    });
  });

  describe('obtenerProgreso() - Panel interactivo', () => {
    it('debe calcular exactamente cuánto falta en dinero y compras para el próximo nivel', async () => {
      // El usuario tiene $150 y 1 compra. Está en Bronce.
      // Plata pide $500 y 3 compras. Le faltan $350 y 2 compras.
      mockVentaRepo.find.mockResolvedValue([{ precio_total: 150 }]);

      const resultado = await service.obtenerProgreso(1);

      expect(resultado.nivel_actual.nombre_nivel).toBe('Bronce');
      expect(resultado.proximo_nivel?.nombre_nivel).toBe('Plata');
      expect(resultado.progreso).toEqual({
        falta_monto: 350,
        falta_compras: 2,
      });
    });

    it('debe retornar progreso null si ya alcanzó el nivel máximo (Oro)', async () => {
      // El usuario tiene $1500 y 6 compras. Cumple Oro.
      mockVentaRepo.find.mockResolvedValue([
        { precio_total: 250 }, { precio_total: 250 }, { precio_total: 250 },
        { precio_total: 250 }, { precio_total: 250 }, { precio_total: 250 }
      ]);

      const resultado = await service.obtenerProgreso(1);

      expect(resultado.nivel_actual.nombre_nivel).toBe('Oro');
      expect(resultado.proximo_nivel).toBeNull();
      expect(resultado.progreso).toBeNull();
    });
  });

  describe('Métodos de consulta general', () => {
    it('debe obtener el registro VIP de un usuario con sus relaciones', async () => {
      const mockClienteVip = { id_usuario: 1, nivel: nivelBronce };
      mockClienteVipRepo.findOne.mockResolvedValue(mockClienteVip);

      const resultado = await service.obtenerPorUsuario(1);

      expect(resultado).toEqual(mockClienteVip);
      expect(mockClienteVipRepo.findOne).toHaveBeenCalledWith({
        where: { id_usuario: 1 },
        relations: { nivel: true },
      });
    });

    it('debe ejecutar el recálculo masivo para todos los clientes', async () => {
      mockClienteVipRepo.find.mockResolvedValue([{ id_usuario: 1 }, { id_usuario: 2 }]);
      // Evitamos que recalcularNivel procese la lógica real y tire errores de undefined
      jest.spyOn(service, 'recalcularNivel').mockResolvedValue(null as any);

      await service.recalcularTodos();

      expect(service.recalcularNivel).toHaveBeenCalledTimes(2);
      expect(service.recalcularNivel).toHaveBeenCalledWith(1);
      expect(service.recalcularNivel).toHaveBeenCalledWith(2);
    });
  });
});