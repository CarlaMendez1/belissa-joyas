import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfiguracionService } from './configuracion.service';
import { Configuracion } from './configuracion.entity';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { AccionAuditoria } from '../auditoria/log-auditoria.entity';

describe('ConfiguracionService', () => {
  let service: ConfiguracionService;

  const mockRepo = { find: jest.fn(), findOneBy: jest.fn(), save: jest.fn() };
  const mockAuditoria = { registrar: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConfiguracionService,
        { provide: getRepositoryToken(Configuracion), useValue: mockRepo },
        { provide: AuditoriaService, useValue: mockAuditoria },
      ],
    }).compile();
    service = module.get(ConfiguracionService);
    jest.resetAllMocks();
  });

  describe('findAll()', () => {
    it('devuelve todas las configuraciones', async () => {
      const filas = [
        { clave: 'tiempo_abandono_carrito_minutos', valor: '60' },
        { clave: 'envio_gratis_desde', valor: '90000' },
      ];
      mockRepo.find.mockResolvedValue(filas);
      await expect(service.findAll()).resolves.toEqual(filas);
    });
  });

  describe('findByClave()', () => {
    it('devuelve el valor de la clave pedida', async () => {
      mockRepo.findOneBy.mockResolvedValue({ clave: 'envio_gratis_desde', valor: '90000' });
      await expect(service.findByClave('envio_gratis_desde')).resolves.toBe('90000');
      expect(mockRepo.findOneBy).toHaveBeenCalledWith({ clave: 'envio_gratis_desde' });
    });

    it('lanza NotFoundException si la clave no existe', async () => {
      mockRepo.findOneBy.mockResolvedValue(null);
      await expect(service.findByClave('inexistente')).rejects.toThrow(NotFoundException);
    });
  });

  describe('actualizar()', () => {
    it('guarda el nuevo valor y registra la auditoría con el valor anterior', async () => {
      mockRepo.findOneBy.mockResolvedValue({ clave: 'tiempo_abandono_carrito_minutos', valor: '60' });
      mockRepo.save.mockImplementation(async (c) => c);

      const res = await service.actualizar('tiempo_abandono_carrito_minutos', '120', 1);

      expect(res.valor).toBe('120');
      expect(mockRepo.save).toHaveBeenCalledWith(expect.objectContaining({ valor: '120' }));
      expect(mockAuditoria.registrar).toHaveBeenCalledWith({
        id_usuario: 1,
        accion: AccionAuditoria.EDITAR,
        entidad: 'Configuracion',
        id_entidad: null,
        datos_anteriores: { clave: 'tiempo_abandono_carrito_minutos', valor: '60' },
        datos_nuevos: { clave: 'tiempo_abandono_carrito_minutos', valor: '120' },
      });
    });

    it('lanza NotFoundException y no audita si la clave no existe', async () => {
      mockRepo.findOneBy.mockResolvedValue(null);
      await expect(service.actualizar('inexistente', '1', 1)).rejects.toThrow(NotFoundException);
      expect(mockRepo.save).not.toHaveBeenCalled();
      expect(mockAuditoria.registrar).not.toHaveBeenCalled();
    });
  });

  describe('obtenerNumero()', () => {
    it('devuelve el valor numérico guardado', async () => {
      mockRepo.findOneBy.mockResolvedValue({ clave: 'stock_minimo', valor: '5' });
      await expect(service.obtenerNumero('stock_minimo', 3)).resolves.toBe(5);
    });

    it('usa el valor por defecto si la clave no existe o no es un número', async () => {
      mockRepo.findOneBy.mockResolvedValueOnce(null);
      await expect(service.obtenerNumero('stock_minimo', 3)).resolves.toBe(3);
      mockRepo.findOneBy.mockResolvedValueOnce({ clave: 'stock_minimo', valor: 'abc' });
      await expect(service.obtenerNumero('stock_minimo', 3)).resolves.toBe(3);
    });
  });

  describe('actualizar() de stock_minimo', () => {
    it('guarda un entero válido, incluido 0', async () => {
      mockRepo.findOneBy.mockResolvedValue({ clave: 'stock_minimo', valor: '3' });
      mockRepo.save.mockImplementation(async (c) => c);
      const r = await service.actualizar('stock_minimo', '0', 1);
      expect(r.valor).toBe('0');
    });

    it.each(['-1', '2.5', 'abc', '', '1000'])('rechaza el valor %p', async (valor) => {
      mockRepo.findOneBy.mockResolvedValue({ clave: 'stock_minimo', valor: '3' });
      await expect(service.actualizar('stock_minimo', valor, 1)).rejects.toThrow(BadRequestException);
      expect(mockRepo.save).not.toHaveBeenCalled();
    });
  });
});
