import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { CategoriaService } from './categoria.service';
import { Categoria, EstadoGeneral } from './categoria.entity';
import { Opcion } from '../opcion/opcion.entity';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { AccionAuditoria } from '../auditoria/log-auditoria.entity';

describe('CategoriaService', () => {
  let service: CategoriaService;

  const mockRepo = { find: jest.fn(), findOne: jest.fn(), save: jest.fn(), update: jest.fn(), manager: { query: jest.fn() } };
  const mockQb = { innerJoin: jest.fn().mockReturnThis(), getMany: jest.fn() };
  const mockOpcionRepo = { createQueryBuilder: jest.fn() };
  const mockAuditoria = { registrar: jest.fn() };

  const anillos = { id_categoria: 1, nombre: 'Anillos', descripcion: 'Anillos de plata y oro', estado: EstadoGeneral.ACTIVA };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoriaService,
        { provide: getRepositoryToken(Categoria), useValue: mockRepo },
        { provide: getRepositoryToken(Opcion), useValue: mockOpcionRepo },
        { provide: AuditoriaService, useValue: mockAuditoria },
      ],
    }).compile();
    service = module.get(CategoriaService);
    jest.clearAllMocks();
    mockOpcionRepo.createQueryBuilder.mockReturnValue(mockQb);
    mockQb.innerJoin.mockReturnThis();
  });

  describe('findAll()', () => {
    it('devuelve solo las categorías activas', async () => {
      mockRepo.find.mockResolvedValue([anillos]);
      const r = await service.findAll();
      expect(mockRepo.find).toHaveBeenCalledWith({ where: { estado: EstadoGeneral.ACTIVA } });
      expect(r).toEqual([anillos]);
    });
  });

  describe('listarConPortada()', () => {
    const cadenas = { id_categoria: 2, nombre: 'Cadenas', estado: EstadoGeneral.ACTIVA, imagen_portada: 'https://x/portada.jpg' };

    it('usa la portada elegida y, si no hay, la foto de un producto', async () => {
      mockRepo.find.mockResolvedValue([{ ...anillos, imagen_portada: null }, cadenas]);
      mockRepo.manager.query.mockResolvedValue([
        { id_categoria: 1, imagen: 'https://x/anillo.jpg' },
        { id_categoria: 2, imagen: 'https://x/cadena.jpg' },
      ]);
      const r = await service.listarConPortada();
      expect(r[0].imagen).toBe('https://x/anillo.jpg');
      expect(r[1].imagen).toBe('https://x/portada.jpg');
    });

    it('devuelve imagen null si no hay portada ni productos con foto', async () => {
      mockRepo.find.mockResolvedValue([{ ...anillos, imagen_portada: null }]);
      mockRepo.manager.query.mockResolvedValue([]);
      const r = await service.listarConPortada();
      expect(r[0].imagen).toBeNull();
    });
  });

  describe('actualizarPortada()', () => {
    it('guarda la URL y audita el cambio', async () => {
      mockRepo.findOne
        .mockResolvedValueOnce({ ...anillos, imagen_portada: null })
        .mockResolvedValueOnce({ ...anillos, imagen_portada: 'https://x/a.jpg' });
      const r = await service.actualizarPortada(1, 'https://x/a.jpg', 9);
      expect(mockRepo.update).toHaveBeenCalledWith(1, { imagen_portada: 'https://x/a.jpg' });
      expect(mockAuditoria.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          id_usuario: 9,
          accion: AccionAuditoria.EDITAR,
          datos_anteriores: { imagen_portada: null },
          datos_nuevos: { imagen_portada: 'https://x/a.jpg' },
        }),
      );
      expect(r.imagen_portada).toBe('https://x/a.jpg');
    });

    it('permite quitar la portada (null)', async () => {
      mockRepo.findOne.mockResolvedValue({ ...anillos, imagen_portada: 'https://x/a.jpg' });
      await service.actualizarPortada(1, null);
      expect(mockRepo.update).toHaveBeenCalledWith(1, { imagen_portada: null });
    });

    it('lanza NotFound si la categoría no existe', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      await expect(service.actualizarPortada(99, 'u')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findById()', () => {
    it('devuelve la categoría si existe', async () => {
      mockRepo.findOne.mockResolvedValue(anillos);
      await expect(service.findById(1)).resolves.toEqual(anillos);
      expect(mockRepo.findOne).toHaveBeenCalledWith({ where: { id_categoria: 1 } });
    });

    it('lanza NotFoundException si no existe', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      await expect(service.findById(99)).rejects.toThrow(NotFoundException);
      await expect(service.findById(99)).rejects.toThrow('Categoría con id 99 no encontrada');
    });
  });

  describe('create()', () => {
    it('guarda la categoría y registra la auditoría de creación', async () => {
      mockRepo.save.mockResolvedValue({ ...anillos, id_categoria: 5, nombre: 'Collares', descripcion: 'Collares y gargantillas' });
      const r = await service.create({ nombre: 'Collares', descripcion: 'Collares y gargantillas' }, 7);
      expect(r.id_categoria).toBe(5);
      expect(mockAuditoria.registrar).toHaveBeenCalledWith({
        id_usuario: 7,
        accion: AccionAuditoria.CREAR,
        entidad: 'Categoria',
        id_entidad: 5,
        datos_nuevos: { nombre: 'Collares', descripcion: 'Collares y gargantillas' },
      });
    });

    it('permite crear sin id de administrador', async () => {
      mockRepo.save.mockResolvedValue({ ...anillos, id_categoria: 6 });
      await service.create({ nombre: 'Pulseras' });
      expect(mockAuditoria.registrar).toHaveBeenCalledWith(expect.objectContaining({ id_usuario: undefined }));
    });
  });

  describe('update()', () => {
    it('actualiza y audita solo los campos modificados con valores anterior y nuevo', async () => {
      mockRepo.findOne
        .mockResolvedValueOnce(anillos)
        .mockResolvedValueOnce({ ...anillos, nombre: 'Anillos y alianzas' });
      const r = await service.update(1, { nombre: 'Anillos y alianzas' }, 3);
      expect(mockRepo.update).toHaveBeenCalledWith(1, { nombre: 'Anillos y alianzas' });
      expect(r.nombre).toBe('Anillos y alianzas');
      expect(mockAuditoria.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          id_usuario: 3,
          accion: AccionAuditoria.EDITAR,
          entidad: 'Categoria',
          id_entidad: 1,
          datos_anteriores: { nombre: 'Anillos' },
          datos_nuevos: { nombre: 'Anillos y alianzas' },
        }),
      );
    });

    it('lanza NotFoundException si la categoría no existe y no modifica nada', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      await expect(service.update(99, { nombre: 'X' })).rejects.toThrow(NotFoundException);
      expect(mockRepo.update).not.toHaveBeenCalled();
      expect(mockAuditoria.registrar).not.toHaveBeenCalled();
    });
  });

  describe('bajaLogica()', () => {
    it('marca la categoría como inactiva y audita la eliminación', async () => {
      mockRepo.findOne
        .mockResolvedValueOnce(anillos)
        .mockResolvedValueOnce({ ...anillos, estado: EstadoGeneral.INACTIVA });
      const r = await service.bajaLogica(1, 2);
      expect(mockRepo.update).toHaveBeenCalledWith(1, { estado: EstadoGeneral.INACTIVA });
      expect(r.estado).toBe(EstadoGeneral.INACTIVA);
      expect(mockAuditoria.registrar).toHaveBeenCalledWith({
        id_usuario: 2,
        accion: AccionAuditoria.ELIMINAR,
        entidad: 'Categoria',
        id_entidad: 1,
        datos_anteriores: { nombre: 'Anillos', estado: EstadoGeneral.ACTIVA },
        datos_nuevos: { estado: EstadoGeneral.INACTIVA },
      });
    });

    it('lanza NotFoundException si no existe', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      await expect(service.bajaLogica(99)).rejects.toThrow(NotFoundException);
      expect(mockRepo.update).not.toHaveBeenCalled();
    });
  });

  describe('obtenerOpcionesPorCategoria()', () => {
    it('devuelve las opciones habilitadas para la categoría', async () => {
      const opciones = [{ id_opcion: 1, nombre: 'Talle' }, { id_opcion: 2, nombre: 'Material' }];
      mockRepo.findOne.mockResolvedValue(anillos);
      mockQb.getMany.mockResolvedValue(opciones);
      const r = await service.obtenerOpcionesPorCategoria(1);
      expect(r).toEqual(opciones);
      expect(mockQb.innerJoin).toHaveBeenCalledWith('opcion.categorias', 'categoria', 'categoria.id_categoria = :id_categoria', { id_categoria: 1 });
    });

    it('lanza NotFoundException si la categoría no existe', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      await expect(service.obtenerOpcionesPorCategoria(99)).rejects.toThrow(NotFoundException);
      expect(mockOpcionRepo.createQueryBuilder).not.toHaveBeenCalled();
    });
  });
});
