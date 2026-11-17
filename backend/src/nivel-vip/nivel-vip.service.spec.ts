import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { NivelVipService } from './nivel-vip.service';
import { NivelVip } from './nivel-vip.entity';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { AccionAuditoria } from '../auditoria/log-auditoria.entity';

describe('NivelVipService', () => {
  let service: NivelVipService;

  const mockRepo = { find: jest.fn(), findOneBy: jest.fn(), save: jest.fn() };
  const mockAuditoria = { registrar: jest.fn() };

  const plata = () => ({
    id_nivel_vip: 1,
    nombre_nivel: 'Plata',
    monto_min_requerido: 150000,
    cantidad_compras_min_requerida: 2,
    porcentaje_descuento: 5,
    beneficios: 'Descuento en cada compra',
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NivelVipService,
        { provide: getRepositoryToken(NivelVip), useValue: mockRepo },
        { provide: AuditoriaService, useValue: mockAuditoria },
      ],
    }).compile();
    service = module.get(NivelVipService);
    jest.resetAllMocks();
  });

  describe('findAll()', () => {
    it('lista los niveles ordenados por monto mínimo ascendente', async () => {
      mockRepo.find.mockResolvedValue([plata()]);
      await service.findAll();
      expect(mockRepo.find).toHaveBeenCalledWith({ order: { monto_min_requerido: 'ASC' } });
    });
  });

  describe('findById()', () => {
    it('devuelve el nivel si existe', async () => {
      mockRepo.findOneBy.mockResolvedValue(plata());
      await expect(service.findById(1)).resolves.toMatchObject({ nombre_nivel: 'Plata' });
    });

    it('lanza NotFoundException si no existe', async () => {
      mockRepo.findOneBy.mockResolvedValue(null);
      await expect(service.findById(99)).rejects.toThrow(NotFoundException);
    });
  });

  describe('update()', () => {
    it('actualiza solo los campos enviados y audita antes/después', async () => {
      mockRepo.findOneBy.mockResolvedValue(plata());
      mockRepo.save.mockImplementation(async (n) => n);

      const res = await service.update(1, { porcentaje_descuento: 8, monto_min_requerido: 180000 }, 7);

      expect(res.porcentaje_descuento).toBe(8);
      expect(res.monto_min_requerido).toBe(180000);
      expect(res.cantidad_compras_min_requerida).toBe(2);
      expect(mockAuditoria.registrar).toHaveBeenCalledWith({
        id_usuario: 7,
        accion: AccionAuditoria.EDITAR,
        entidad: 'NivelVip',
        id_entidad: 1,
        datos_anteriores: { nombre_nivel: 'Plata', porcentaje_descuento: 5, monto_min_requerido: 150000 },
        datos_nuevos: { porcentaje_descuento: 8, monto_min_requerido: 180000 },
      });
    });

    it('lanza NotFoundException si el nivel no existe y no guarda ni audita', async () => {
      mockRepo.findOneBy.mockResolvedValue(null);
      await expect(service.update(99, { porcentaje_descuento: 10 }, 7)).rejects.toThrow(NotFoundException);
      expect(mockRepo.save).not.toHaveBeenCalled();
      expect(mockAuditoria.registrar).not.toHaveBeenCalled();
    });
  });
});
