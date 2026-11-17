import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { CaracteristicaService } from './caracteristica.service';
import { Caracteristica } from './caracteristica.entity';
import { Opcion } from '../opcion/opcion.entity';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { AccionAuditoria } from '../auditoria/log-auditoria.entity';

const errorBD = (code: string, constraint?: string) =>
  new QueryFailedError('INSERT', [], { code, constraint, message: 'falló' } as any);

describe('CaracteristicaService', () => {
  let service: CaracteristicaService;

  const mockRepo = {
    find: jest.fn(),
    findOneBy: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
  };
  const mockOpcionRepo = { findOneBy: jest.fn() };
  const mockAuditoria = { registrar: jest.fn() };

  const opcionTalle = { id_opcion: 1, nombre: 'Talle', tipo_dato: 'numero', unidad: 'nº' };
  const opcionMaterial = { id_opcion: 2, nombre: 'Material', tipo_dato: 'texto', unidad: null };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CaracteristicaService,
        { provide: getRepositoryToken(Caracteristica), useValue: mockRepo },
        { provide: getRepositoryToken(Opcion), useValue: mockOpcionRepo },
        { provide: AuditoriaService, useValue: mockAuditoria },
      ],
    }).compile();
    service = module.get(CaracteristicaService);
  });

  describe('consultas', () => {
    it('findAll trae la opción y ordena por opción', async () => {
      mockRepo.find.mockResolvedValue([]);
      await service.findAll();
      expect(mockRepo.find).toHaveBeenCalledWith({ relations: { opcion: true }, order: { id_opcion: 'ASC' } });
    });

    it('findPorOpcion filtra por opción y ordena por valor', async () => {
      mockRepo.find.mockResolvedValue([]);
      await service.findPorOpcion(1);
      expect(mockRepo.find).toHaveBeenCalledWith({ where: { id_opcion: 1 }, order: { valor: 'ASC' } });
    });

    it('findById devuelve la característica', async () => {
      mockRepo.findOneBy.mockResolvedValue({ id_caracteristica: 3, valor: '14' });
      expect((await service.findById(3)).valor).toBe('14');
    });

    it('findById lanza NotFoundException si no existe', async () => {
      mockRepo.findOneBy.mockResolvedValue(null);
      await expect(service.findById(99)).rejects.toThrow(NotFoundException);
    });
  });

  describe('create()', () => {
    it('opción de texto: normaliza espacios y audita con el nombre de la opción', async () => {
      mockOpcionRepo.findOneBy.mockResolvedValue(opcionMaterial);
      mockRepo.save.mockImplementation(async (c) => ({ id_caracteristica: 8, ...c }));

      const res = await service.create({ id_opcion: 2, valor: '  Plata   925 ' }, 3);

      expect(res!.valor).toBe('Plata 925');
      expect(mockAuditoria.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          accion: AccionAuditoria.CREAR,
          entidad: 'Caracteristica',
          id_entidad: 8,
          datos_nuevos: { opcion: 'Material', valor: 'Plata 925' },
        }),
      );
    });

    it('opción numérica: acepta coma decimal y guarda con punto', async () => {
      mockOpcionRepo.findOneBy.mockResolvedValue({ ...opcionTalle, nombre: 'Largo', unidad: 'cm' });
      mockRepo.save.mockImplementation(async (c) => ({ id_caracteristica: 9, ...c }));

      const res = await service.create({ id_opcion: 1, valor: '17,5' }, 3);
      expect(res!.valor).toBe('17.5');
    });

    it('opción numérica: rechaza texto con BadRequestException', async () => {
      mockOpcionRepo.findOneBy.mockResolvedValue(opcionTalle);
      await expect(service.create({ id_opcion: 1, valor: 'catorce' }, 3)).rejects.toThrow(BadRequestException);
      await expect(service.create({ id_opcion: 1, valor: '14 mm' }, 3)).rejects.toThrow(/solo admite números/);
      expect(mockRepo.save).not.toHaveBeenCalled();
    });

    it('lanza NotFoundException si la opción no existe', async () => {
      mockOpcionRepo.findOneBy.mockResolvedValue(null);
      await expect(service.create({ id_opcion: 99, valor: 'x' }, 3)).rejects.toThrow(NotFoundException);
    });

    it('traduce valor duplicado (23505) a ConflictException con mensaje claro', async () => {
      mockOpcionRepo.findOneBy.mockResolvedValue(opcionTalle);
      mockRepo.save.mockRejectedValue(errorBD('23505', 'uq_caracteristica_valor_por_opcion'));
      const p = service.create({ id_opcion: 1, valor: '14' }, 3);
      await expect(p).rejects.toBeInstanceOf(ConflictException);
      await expect(
        service.create({ id_opcion: 1, valor: '14' }, 3),
      ).rejects.toThrow('Esa opción ya tiene una característica con ese valor');
      expect(mockAuditoria.registrar).not.toHaveBeenCalled();
    });

    it('traduce valor vacío (23514) a BadRequestException', async () => {
      mockOpcionRepo.findOneBy.mockResolvedValue(opcionMaterial);
      mockRepo.save.mockRejectedValue(errorBD('23514', 'ck_caracteristica_valor_no_vacio'));
      await expect(service.create({ id_opcion: 2, valor: ' ' }, 3)).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('update()', () => {
    it('cambia el valor y audita solo el valor', async () => {
      mockRepo.findOneBy.mockResolvedValue({ id_caracteristica: 3, id_opcion: 2, valor: 'Plata 925' });
      mockOpcionRepo.findOneBy.mockResolvedValue(opcionMaterial);
      mockRepo.save.mockImplementation(async (c) => c);

      const res = await service.update(3, { valor: 'Oro 18k' }, 3);

      expect(res!.valor).toBe('Oro 18k');
      expect(mockAuditoria.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          accion: AccionAuditoria.EDITAR,
          datos_anteriores: { valor: 'Plata 925' },
          datos_nuevos: { valor: 'Oro 18k' },
        }),
      );
    });

    it('al mover a otra opción registra el cambio de opción', async () => {
      mockRepo.findOneBy.mockResolvedValue({ id_caracteristica: 3, id_opcion: 2, valor: 'Dorado' });
      mockOpcionRepo.findOneBy.mockImplementation(async ({ id_opcion }: any) =>
        id_opcion === 2 ? opcionMaterial : { id_opcion: 4, nombre: 'Color', tipo_dato: 'texto', unidad: null },
      );
      mockRepo.save.mockImplementation(async (c) => c);

      await service.update(3, { id_opcion: 4 }, 3);

      expect(mockAuditoria.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          datos_anteriores: { opcion: 'Material' },
          datos_nuevos: { opcion: 'Color' },
        }),
      );
    });

    it('si no hay cambios reales no audita', async () => {
      mockRepo.findOneBy.mockResolvedValue({ id_caracteristica: 3, id_opcion: 2, valor: 'Plata 925' });
      mockOpcionRepo.findOneBy.mockResolvedValue(opcionMaterial);
      mockRepo.save.mockImplementation(async (c) => c);
      await service.update(3, { valor: 'Plata 925' }, 3);
      expect(mockAuditoria.registrar).not.toHaveBeenCalled();
    });

    it('valida el valor contra el tipo de la opción', async () => {
      mockRepo.findOneBy.mockResolvedValue({ id_caracteristica: 3, id_opcion: 1, valor: '14' });
      mockOpcionRepo.findOneBy.mockResolvedValue(opcionTalle);
      await expect(service.update(3, { valor: 'grande' }, 3)).rejects.toThrow(BadRequestException);
      expect(mockRepo.save).not.toHaveBeenCalled();
    });

    it('lanza NotFoundException si no existe', async () => {
      mockRepo.findOneBy.mockResolvedValue(null);
      await expect(service.update(99, { valor: '1' }, 3)).rejects.toThrow(NotFoundException);
    });

    it('traduce duplicados al guardar', async () => {
      mockRepo.findOneBy.mockResolvedValue({ id_caracteristica: 3, id_opcion: 1, valor: '14' });
      mockOpcionRepo.findOneBy.mockResolvedValue(opcionTalle);
      mockRepo.save.mockRejectedValue(errorBD('23505', 'uq_caracteristica_valor_por_opcion'));
      await expect(service.update(3, { valor: '16' }, 3)).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('remove()', () => {
    it('elimina y audita con el valor y la opción', async () => {
      mockRepo.findOneBy.mockResolvedValue({ id_caracteristica: 3, id_opcion: 1, valor: '14' });
      mockOpcionRepo.findOneBy.mockResolvedValue(opcionTalle);

      const res = await service.remove(3, 3);

      expect(mockRepo.remove).toHaveBeenCalled();
      expect(mockAuditoria.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          accion: AccionAuditoria.ELIMINAR,
          datos_anteriores: { opcion: 'Talle', valor: '14' },
        }),
      );
      expect(res).toEqual({ mensaje: 'Característica eliminada' });
    });

    it('lanza NotFoundException si no existe', async () => {
      mockRepo.findOneBy.mockResolvedValue(null);
      await expect(service.remove(99, 3)).rejects.toThrow(NotFoundException);
      expect(mockRepo.remove).not.toHaveBeenCalled();
    });
  });
});
