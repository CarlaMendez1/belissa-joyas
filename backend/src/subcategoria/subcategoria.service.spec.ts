import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SubcategoriaService } from './subcategoria.service';
import { Subcategoria } from './subcategoria.entity';
import { EstadoGeneral } from '../categoria/categoria.entity';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { AccionAuditoria } from '../auditoria/log-auditoria.entity';

describe('SubcategoriaService', () => {
  let service: SubcategoriaService;

  const mockRepo = { find: jest.fn(), findOneBy: jest.fn(), save: jest.fn(), update: jest.fn() };
  const mockAuditoria = { registrar: jest.fn() };

  const solitarios = { id_subcategoria: 4, id_categoria: 1, nombre: 'Solitarios', descripcion: 'Anillos con una piedra', estado: EstadoGeneral.ACTIVA };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubcategoriaService,
        { provide: getRepositoryToken(Subcategoria), useValue: mockRepo },
        { provide: AuditoriaService, useValue: mockAuditoria },
      ],
    }).compile();
    service = module.get(SubcategoriaService);
    jest.clearAllMocks();
  });

  describe('findAll()', () => {
    it('devuelve solo las subcategorías activas', async () => {
      mockRepo.find.mockResolvedValue([solitarios]);
      await expect(service.findAll()).resolves.toEqual([solitarios]);
      expect(mockRepo.find).toHaveBeenCalledWith({ where: { estado: EstadoGeneral.ACTIVA } });
    });
  });

  describe('findByCategoria()', () => {
    it('filtra por categoría y por estado activo', async () => {
      mockRepo.find.mockResolvedValue([solitarios]);
      const r = await service.findByCategoria(1);
      expect(mockRepo.find).toHaveBeenCalledWith({ where: { id_categoria: 1, estado: EstadoGeneral.ACTIVA } });
      expect(r).toHaveLength(1);
    });

    it('devuelve lista vacía si la categoría no tiene subcategorías', async () => {
      mockRepo.find.mockResolvedValue([]);
      await expect(service.findByCategoria(50)).resolves.toEqual([]);
    });
  });

  describe('create()', () => {
    it('guarda la subcategoría y audita la creación', async () => {
      mockRepo.save.mockResolvedValue({ ...solitarios, id_subcategoria: 9, nombre: 'Alianzas' });
      const r = await service.create({ id_categoria: 1, nombre: 'Alianzas', descripcion: 'Anillos de casamiento' }, 5);
      expect(r.id_subcategoria).toBe(9);
      expect(mockAuditoria.registrar).toHaveBeenCalledWith({
        id_usuario: 5,
        accion: AccionAuditoria.CREAR,
        entidad: 'Subcategoria',
        id_entidad: 9,
        datos_nuevos: { nombre: 'Alianzas', descripcion: 'Anillos con una piedra', id_categoria: 1 },
      });
    });
  });

  describe('update()', () => {
    it('actualiza y audita los campos modificados', async () => {
      mockRepo.findOneBy
        .mockResolvedValueOnce(solitarios)
        .mockResolvedValueOnce({ ...solitarios, nombre: 'Solitarios clásicos' });
      const r = await service.update(4, { nombre: 'Solitarios clásicos' }, 2);
      expect(mockRepo.update).toHaveBeenCalledWith(4, { nombre: 'Solitarios clásicos' });
      expect(r?.nombre).toBe('Solitarios clásicos');
      expect(mockAuditoria.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          id_usuario: 2,
          accion: AccionAuditoria.EDITAR,
          id_entidad: 4,
          datos_anteriores: { nombre: 'Solitarios' },
          datos_nuevos: { nombre: 'Solitarios clásicos' },
        }),
      );
    });

    it('si la subcategoría no existe devuelve null y no audita', async () => {
      mockRepo.findOneBy.mockResolvedValue(null);
      await expect(service.update(99, { nombre: 'X' })).resolves.toBeNull();
      expect(mockAuditoria.registrar).not.toHaveBeenCalled();
    });
  });

  describe('bajaLogica()', () => {
    it('marca como inactiva y audita la baja', async () => {
      mockRepo.findOneBy
        .mockResolvedValueOnce(solitarios)
        .mockResolvedValueOnce({ ...solitarios, estado: EstadoGeneral.INACTIVA });
      const r = await service.bajaLogica(4, 1);
      expect(mockRepo.update).toHaveBeenCalledWith(4, { estado: EstadoGeneral.INACTIVA });
      expect(r?.estado).toBe(EstadoGeneral.INACTIVA);
      expect(mockAuditoria.registrar).toHaveBeenCalledWith({
        id_usuario: 1,
        accion: AccionAuditoria.ELIMINAR,
        entidad: 'Subcategoria',
        id_entidad: 4,
        datos_anteriores: { nombre: 'Solitarios', estado: EstadoGeneral.ACTIVA },
        datos_nuevos: { estado: EstadoGeneral.INACTIVA },
      });
    });

    it('si no existe no audita y devuelve null (el update se ejecuta igual)', async () => {
      mockRepo.findOneBy.mockResolvedValue(null);
      await expect(service.bajaLogica(99)).resolves.toBeNull();
      expect(mockAuditoria.registrar).not.toHaveBeenCalled();
    });
  });
});
