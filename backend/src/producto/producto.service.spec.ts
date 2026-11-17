import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { ProductoService } from './producto.service';
import { Producto, EstadoProducto } from './producto.entity';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { AccionAuditoria } from '../auditoria/log-auditoria.entity';

describe('ProductoService', () => {
  let service: ProductoService;

  const mockRepo = {
    find: jest.fn(),
    findOneBy: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    manager: { query: jest.fn() },
  };
  const mockAuditoria = { registrar: jest.fn() };

  const anillo = {
    id_producto: 1,
    id_subcategoria: 3,
    nombre: 'Anillo solitario plata 925',
    estado: EstadoProducto.ACTIVO,
    imagenes: ['https://img.belissa.com/anillo-1.jpg'],
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductoService,
        { provide: getRepositoryToken(Producto), useValue: mockRepo },
        { provide: AuditoriaService, useValue: mockAuditoria },
      ],
    }).compile();
    service = module.get(ProductoService);
  });

  describe('findAll()', () => {
    it('devuelve los activos con el precio "desde" de sus variantes activas', async () => {
      mockRepo.find.mockResolvedValue([anillo, { ...anillo, id_producto: 2, nombre: 'Collar corazón acero' }]);
      mockRepo.manager.query.mockResolvedValue([
        { id_producto: 1, precio_desde: '48900.00', precios_distintos: '2' },
        { id_producto: 2, precio_desde: '27500.00', precios_distintos: '1' },
      ]);

      const res = await service.findAll();

      expect(mockRepo.find).toHaveBeenCalledWith({ where: { estado: EstadoProducto.ACTIVO } });
      expect(res[0]).toMatchObject({ precio_desde: 48900, varios_precios: true });
      expect(res[1]).toMatchObject({ precio_desde: 27500, varios_precios: false });
    });

    it('marca precio_desde null si el producto no tiene variantes activas', async () => {
      mockRepo.find.mockResolvedValue([anillo]);
      mockRepo.manager.query.mockResolvedValue([]);

      const res = await service.findAll();

      expect(res[0].precio_desde).toBeNull();
      expect(res[0].varios_precios).toBe(false);
    });

    it('devuelve lista vacía si no hay productos', async () => {
      mockRepo.find.mockResolvedValue([]);
      mockRepo.manager.query.mockResolvedValue([]);
      expect(await service.findAll()).toEqual([]);
    });
  });

  describe('findById()', () => {
    it('devuelve el producto', async () => {
      mockRepo.findOneBy.mockResolvedValue(anillo);
      expect(await service.findById(1)).toBe(anillo);
    });

    it('lanza NotFoundException si no existe', async () => {
      mockRepo.findOneBy.mockResolvedValue(null);
      await expect(service.findById(99)).rejects.toThrow(NotFoundException);
    });
  });

  describe('create()', () => {
    it('genera el SKU BEL-<timestamp>, guarda y audita la creación', async () => {
      const dto = { nombre: 'Collar con dije corazón', id_subcategoria: 4 } as any;
      mockRepo.save.mockImplementation(async (p) => ({ id_producto: 7, ...p }));

      const res = await service.create(dto, 5);

      expect(res.codigo_sku).toMatch(/^BEL-\d+$/);
      expect(mockRepo.save).toHaveBeenCalledWith(expect.objectContaining({ nombre: dto.nombre }));
      expect(mockAuditoria.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          id_usuario: 5,
          accion: AccionAuditoria.CREAR,
          entidad: 'Producto',
          id_entidad: 7,
          datos_nuevos: expect.objectContaining({ nombre: dto.nombre, id_subcategoria: 4 }),
        }),
      );
    });
  });

  describe('update()', () => {
    it('actualiza y audita solo las claves modificadas', async () => {
      mockRepo.findOneBy
        .mockResolvedValueOnce({ ...anillo })
        .mockResolvedValueOnce({ ...anillo, nombre: 'Anillo solitario plata 925 rodiada' });

      const res = await service.update(1, { nombre: 'Anillo solitario plata 925 rodiada' }, 5);

      expect(mockRepo.update).toHaveBeenCalledWith(1, { nombre: 'Anillo solitario plata 925 rodiada' });
      expect(res.nombre).toBe('Anillo solitario plata 925 rodiada');
      expect(mockAuditoria.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          accion: AccionAuditoria.EDITAR,
          datos_anteriores: { nombre: 'Anillo solitario plata 925' },
          datos_nuevos: { nombre: 'Anillo solitario plata 925 rodiada' },
        }),
      );
    });

    it('lanza NotFoundException si el producto no existe y no actualiza', async () => {
      mockRepo.findOneBy.mockResolvedValue(null);
      await expect(service.update(99, { nombre: 'X' })).rejects.toThrow(NotFoundException);
      expect(mockRepo.update).not.toHaveBeenCalled();
      expect(mockAuditoria.registrar).not.toHaveBeenCalled();
    });
  });

  describe('agregarImagen()', () => {
    it('agrega la URL al final del arreglo existente', async () => {
      mockRepo.findOneBy.mockResolvedValue({ ...anillo });
      await service.agregarImagen(1, 'https://img.belissa.com/anillo-2.jpg', 5);

      expect(mockRepo.update).toHaveBeenCalledWith(1, {
        imagenes: ['https://img.belissa.com/anillo-1.jpg', 'https://img.belissa.com/anillo-2.jpg'],
      });
      expect(mockAuditoria.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          datos_anteriores: { cantidad_imagenes: 1 },
          datos_nuevos: { cantidad_imagenes: 2, imagen_agregada: 'https://img.belissa.com/anillo-2.jpg' },
        }),
      );
    });

    it('funciona si el producto no tenía imágenes (null)', async () => {
      mockRepo.findOneBy.mockResolvedValue({ ...anillo, imagenes: null });
      await service.agregarImagen(1, 'https://img.belissa.com/a.jpg');
      expect(mockRepo.update).toHaveBeenCalledWith(1, { imagenes: ['https://img.belissa.com/a.jpg'] });
    });

    it('lanza NotFoundException si el producto no existe', async () => {
      mockRepo.findOneBy.mockResolvedValue(null);
      await expect(service.agregarImagen(99, 'x')).rejects.toThrow(NotFoundException);
    });
  });

  describe('eliminarImagen()', () => {
    it('quita solo la URL indicada', async () => {
      mockRepo.findOneBy.mockResolvedValue({
        ...anillo,
        imagenes: ['https://img.belissa.com/a.jpg', 'https://img.belissa.com/b.jpg'],
      });
      await service.eliminarImagen(1, 'https://img.belissa.com/a.jpg', 5);

      expect(mockRepo.update).toHaveBeenCalledWith(1, { imagenes: ['https://img.belissa.com/b.jpg'] });
      expect(mockAuditoria.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          datos_anteriores: { cantidad_imagenes: 2, imagen_quitada: 'https://img.belissa.com/a.jpg' },
          datos_nuevos: { cantidad_imagenes: 1 },
        }),
      );
    });

    it('si la URL no está, deja las imágenes como estaban', async () => {
      mockRepo.findOneBy.mockResolvedValue({ ...anillo });
      await service.eliminarImagen(1, 'https://img.belissa.com/otra.jpg');
      expect(mockRepo.update).toHaveBeenCalledWith(1, { imagenes: anillo.imagenes });
    });

    it('lanza NotFoundException si el producto no existe', async () => {
      mockRepo.findOneBy.mockResolvedValue(null);
      await expect(service.eliminarImagen(99, 'x')).rejects.toThrow(NotFoundException);
    });
  });

  describe('bajaLogica()', () => {
    it('pasa el producto a inactivo y audita la baja', async () => {
      mockRepo.findOneBy
        .mockResolvedValueOnce({ ...anillo })
        .mockResolvedValueOnce({ ...anillo, estado: EstadoProducto.INACTIVO });

      const res = await service.bajaLogica(1, 5);

      expect(mockRepo.update).toHaveBeenCalledWith(1, { estado: EstadoProducto.INACTIVO });
      expect(res.estado).toBe(EstadoProducto.INACTIVO);
      expect(mockAuditoria.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          accion: AccionAuditoria.ELIMINAR,
          datos_anteriores: { estado: EstadoProducto.ACTIVO, nombre: anillo.nombre },
          datos_nuevos: { estado: EstadoProducto.INACTIVO },
        }),
      );
    });

    it('lanza NotFoundException si no existe', async () => {
      mockRepo.findOneBy.mockResolvedValue(null);
      await expect(service.bajaLogica(99, 5)).rejects.toThrow(NotFoundException);
      expect(mockRepo.update).not.toHaveBeenCalled();
    });
  });
});
