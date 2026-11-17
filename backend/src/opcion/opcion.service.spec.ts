import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { OpcionService } from './opcion.service';
import { Opcion } from './opcion.entity';
import { Categoria } from '../categoria/categoria.entity';
import { Caracteristica } from '../caracteristica/caracteristica.entity';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { AccionAuditoria } from '../auditoria/log-auditoria.entity';

const errorBD = (code: string, constraint?: string) =>
  new QueryFailedError('INSERT', [], { code, constraint, message: 'falló' } as any);

describe('OpcionService', () => {
  let service: OpcionService;

  const qb: any = {};
  ['delete', 'from', 'where'].forEach((m) => (qb[m] = jest.fn().mockReturnValue(qb)));
  qb.execute = jest.fn().mockResolvedValue({});

  const mockRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
    manager: { createQueryBuilder: jest.fn() },
  };
  const mockCategoriaRepo = { findBy: jest.fn() };
  const mockCaracRepo = { find: jest.fn(), delete: jest.fn() };
  const mockAuditoria = { registrar: jest.fn() };

  const anillos = { id_categoria: 1, nombre: 'Anillos' };
  const collares = { id_categoria: 2, nombre: 'Collares' };
  const talle = () => ({ id_opcion: 1, nombre: 'Talle', tipo_dato: 'numero', unidad: 'nº', categorias: [anillos] });

  beforeEach(async () => {
    jest.clearAllMocks();
    mockRepo.manager.createQueryBuilder.mockReturnValue(qb);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OpcionService,
        { provide: getRepositoryToken(Opcion), useValue: mockRepo },
        { provide: getRepositoryToken(Categoria), useValue: mockCategoriaRepo },
        { provide: getRepositoryToken(Caracteristica), useValue: mockCaracRepo },
        { provide: AuditoriaService, useValue: mockAuditoria },
      ],
    }).compile();
    service = module.get(OpcionService);
  });

  describe('findAll() / findById()', () => {
    it('lista las opciones ordenadas por nombre con sus categorías', async () => {
      mockRepo.find.mockResolvedValue([talle()]);
      await service.findAll();
      expect(mockRepo.find).toHaveBeenCalledWith({ order: { nombre: 'ASC' }, relations: { categorias: true } });
    });

    it('findById devuelve la opción', async () => {
      mockRepo.findOne.mockResolvedValue(talle());
      expect((await service.findById(1)).nombre).toBe('Talle');
    });

    it('findById lanza NotFoundException si no existe', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      await expect(service.findById(9)).rejects.toThrow(NotFoundException);
    });
  });

  describe('create()', () => {
    it('crea una opción numérica normalizando espacios y audita', async () => {
      mockCategoriaRepo.findBy.mockResolvedValue([anillos]);
      mockRepo.save.mockImplementation(async (o) => ({ id_opcion: 4, ...o }));

      const res = await service.create(
        { nombre: '  Largo   de cadena ', tipo_dato: 'numero', unidad: ' cm ', categorias: [1] } as any,
        3,
      );

      expect(res).toMatchObject({ nombre: 'Largo de cadena', unidad: 'cm', tipo_dato: 'numero' });
      expect(mockAuditoria.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          accion: AccionAuditoria.CREAR,
          entidad: 'Opcion',
          id_entidad: 4,
          datos_nuevos: { nombre: 'Largo de cadena', tipo_dato: 'numero', unidad: 'cm', categorias: ['Anillos'] },
        }),
      );
    });

    it('una opción de texto se guarda sin unidad', async () => {
      mockCategoriaRepo.findBy.mockResolvedValue([]);
      mockRepo.save.mockImplementation(async (o) => ({ id_opcion: 5, ...o }));
      const res = await service.create({ nombre: 'Material', tipo_dato: 'texto', unidad: 'x' } as any, 3);
      expect(res!.unidad).toBeNull();
    });

    it('sin categorías no consulta el repositorio de categorías', async () => {
      mockRepo.save.mockImplementation(async (o) => ({ id_opcion: 6, ...o }));
      await service.create({ nombre: 'Color', tipo_dato: 'texto' } as any, 3);
      expect(mockCategoriaRepo.findBy).not.toHaveBeenCalled();
    });

    it('traduce el nombre duplicado (23505) a ConflictException', async () => {
      mockRepo.save.mockRejectedValue(errorBD('23505', 'uq_opcion_nombre_normalizado'));
      await expect(service.create({ nombre: 'Talle', tipo_dato: 'numero', unidad: 'nº' } as any, 3)).rejects.toThrow(
        'Ya existe una opción con ese nombre',
      );
      await expect(service.create({ nombre: 'Talle', tipo_dato: 'numero', unidad: 'nº' } as any, 3)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(mockAuditoria.registrar).not.toHaveBeenCalled();
    });

    it('traduce una violación de check (23514) a BadRequestException', async () => {
      mockRepo.save.mockRejectedValue(errorBD('23514', 'ck_opcion_unidad'));
      await expect(service.create({ nombre: 'Largo', tipo_dato: 'numero' } as any, 3)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('propaga errores desconocidos', async () => {
      mockRepo.save.mockRejectedValue(new Error('conexión caída'));
      await expect(service.create({ nombre: 'X', tipo_dato: 'texto' } as any, 3)).rejects.toThrow('conexión caída');
    });
  });

  describe('update()', () => {
    it('cambia el nombre y audita solo lo que cambió', async () => {
      mockRepo.findOne.mockResolvedValue(talle());
      mockRepo.save.mockImplementation(async (o) => o);

      await service.update(1, { nombre: '  Talle  de anillo ' } as any, 3);

      expect(mockAuditoria.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          accion: AccionAuditoria.EDITAR,
          datos_anteriores: { nombre: 'Talle' },
          datos_nuevos: { nombre: 'Talle de anillo' },
        }),
      );
    });

    it('al pasar a texto limpia la unidad', async () => {
      mockRepo.findOne.mockResolvedValue(talle());
      mockRepo.save.mockImplementation(async (o) => o);

      const res = await service.update(1, { tipo_dato: 'texto' } as any, 3);

      expect(res!.unidad).toBeNull();
      expect(mockAuditoria.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          datos_anteriores: { tipo_dato: 'numero', unidad: 'nº' },
          datos_nuevos: { tipo_dato: 'texto', unidad: null },
        }),
      );
    });

    it('reemplaza las categorías y registra el cambio ordenado', async () => {
      mockRepo.findOne.mockResolvedValue(talle());
      mockCategoriaRepo.findBy.mockResolvedValue([collares, anillos]);
      mockRepo.save.mockImplementation(async (o) => o);

      await service.update(1, { categorias: [1, 2] } as any, 3);

      expect(mockAuditoria.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          datos_anteriores: { categorias: ['Anillos'] },
          datos_nuevos: { categorias: ['Anillos', 'Collares'] },
        }),
      );
    });

    it('si no hubo cambios no registra auditoría', async () => {
      mockRepo.findOne.mockResolvedValue(talle());
      mockRepo.save.mockImplementation(async (o) => o);
      await service.update(1, { nombre: 'Talle' } as any, 3);
      expect(mockAuditoria.registrar).not.toHaveBeenCalled();
    });

    it('lanza NotFoundException si no existe', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      await expect(service.update(9, {} as any, 3)).rejects.toThrow(NotFoundException);
    });

    it('traduce el trigger de cambio de tipo y los duplicados', async () => {
      mockRepo.findOne.mockResolvedValue(talle());
      mockRepo.save.mockRejectedValue(errorBD('23505', 'uq_opcion_nombre_normalizado'));
      await expect(service.update(1, { nombre: 'Material' } as any, 3)).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('remove()', () => {
    it('borra primero la tabla puente, luego las características y la opción', async () => {
      mockRepo.findOne.mockResolvedValue(talle());
      mockCaracRepo.find.mockResolvedValue([{ id_caracteristica: 10 }, { id_caracteristica: 11 }]);

      const res = await service.remove(1, 3);

      expect(qb.from).toHaveBeenCalledWith('variante_caracteristica');
      expect(qb.where).toHaveBeenCalledWith('id_caracteristica IN (:...ids)', { ids: [10, 11] });
      expect(mockCaracRepo.delete).toHaveBeenCalledWith({ id_opcion: 1 });
      expect(mockRepo.remove).toHaveBeenCalled();
      expect(mockAuditoria.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          accion: AccionAuditoria.ELIMINAR,
          datos_anteriores: expect.objectContaining({ nombre: 'Talle', valores_eliminados: 2 }),
        }),
      );
      expect(res).toEqual({ mensaje: 'Opción eliminada' });
    });

    it('sin características solo elimina la opción', async () => {
      mockRepo.findOne.mockResolvedValue(talle());
      mockCaracRepo.find.mockResolvedValue([]);

      await service.remove(1, 3);

      expect(mockRepo.manager.createQueryBuilder).not.toHaveBeenCalled();
      expect(mockCaracRepo.delete).not.toHaveBeenCalled();
      expect(mockRepo.remove).toHaveBeenCalled();
    });

    it('lanza NotFoundException si no existe y no borra nada', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      await expect(service.remove(9, 3)).rejects.toThrow(NotFoundException);
      expect(mockRepo.remove).not.toHaveBeenCalled();
    });
  });
});
