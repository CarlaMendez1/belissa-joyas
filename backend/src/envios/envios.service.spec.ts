import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { EnviosService } from './envios.service';
import { Provincia } from './provincia.entity';
import { DireccionEnvio } from './direccion-envio.entity';
import { TarifaEnvio } from './tarifa-envio.entity';
import { ConfiguracionService } from '../configuracion/configuracion.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { AccionAuditoria } from '../auditoria/log-auditoria.entity';

describe('EnviosService', () => {
  let service: EnviosService;

  const manager = { transaction: jest.fn(), count: jest.fn(), update: jest.fn(), save: jest.fn() };
  const mockProvinciaRepo = { find: jest.fn(), findOneBy: jest.fn() };
  const mockDireccionRepo = { find: jest.fn(), findOne: jest.fn(), manager };
  const mockTarifaRepo = { find: jest.fn(), findOne: jest.fn(), findOneOrFail: jest.fn(), update: jest.fn() };
  const mockConfig = { findByClave: jest.fn() };
  const mockAuditoria = { registrar: jest.fn() };

  // Configuración simulada de la tienda
  const configurar = (valores: Record<string, string>) =>
    mockConfig.findByClave.mockImplementation(async (clave: string) => {
      if (clave in valores) return valores[clave];
      throw new NotFoundException(`Configuración '${clave}' no encontrada`);
    });

  const dtoDireccion = {
    nombre_destinatario: '  Valentina   Rojas ',
    telefono: '351 5558421',
    calle: 'Av. Colón',
    numero: '1340',
    piso_depto: '2 B',
    localidad: 'Córdoba',
    id_provincia: 5,
    codigo_postal: 'x5000abc',
    observaciones: '',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EnviosService,
        { provide: getRepositoryToken(Provincia), useValue: mockProvinciaRepo },
        { provide: getRepositoryToken(DireccionEnvio), useValue: mockDireccionRepo },
        { provide: getRepositoryToken(TarifaEnvio), useValue: mockTarifaRepo },
        { provide: ConfiguracionService, useValue: mockConfig },
        { provide: AuditoriaService, useValue: mockAuditoria },
      ],
    }).compile();
    service = module.get(EnviosService);
    jest.resetAllMocks();
    // La transacción ejecuta el callback con el manager simulado
    manager.transaction.mockImplementation(async (cb: any) => cb(manager));
  });

  describe('listarProvincias()', () => {
    it('lista las provincias ordenadas por nombre', async () => {
      mockProvinciaRepo.find.mockResolvedValue([{ nombre: 'Córdoba' }]);
      await service.listarProvincias();
      expect(mockProvinciaRepo.find).toHaveBeenCalledWith({ order: { nombre: 'ASC' } });
    });
  });

  describe('opcionesEntrega()', () => {
    it('interpreta la configuración de la tienda', async () => {
      configurar({
        retiro_local_activo: ' TRUE ',
        retiro_local_direccion: 'Rivadavia 456, Córdoba',
        envio_gratis_desde: '90000',
      });
      await expect(service.opcionesEntrega()).resolves.toEqual({
        retiro_local_activo: true,
        retiro_local_direccion: 'Rivadavia 456, Córdoba',
        envio_gratis_desde: 90000,
      });
    });

    it('usa valores por defecto si faltan las claves', async () => {
      configurar({});
      await expect(service.opcionesEntrega()).resolves.toEqual({
        retiro_local_activo: false,
        retiro_local_direccion: '',
        envio_gratis_desde: 0,
      });
    });

    it('propaga errores que no sean NotFound', async () => {
      mockConfig.findByClave.mockRejectedValue(new Error('BD caída'));
      await expect(service.opcionesEntrega()).rejects.toThrow('BD caída');
    });
  });

  describe('direcciones del cliente', () => {
    it('listarDirecciones() trae solo las activas del usuario', async () => {
      mockDireccionRepo.find.mockResolvedValue([]);
      await service.listarDirecciones(3);
      expect(mockDireccionRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id_usuario: 3, activa: true } }),
      );
    });

    it('buscarPropia() devuelve la dirección del usuario', async () => {
      mockDireccionRepo.findOne.mockResolvedValue({ id_direccion: 10, id_usuario: 3 });
      await expect(service.buscarPropia(3, 10)).resolves.toMatchObject({ id_direccion: 10 });
    });

    it('buscarPropia() lanza NotFoundException si es de otro usuario o está dada de baja', async () => {
      mockDireccionRepo.findOne.mockResolvedValue(null);
      await expect(service.buscarPropia(3, 99)).rejects.toThrow(NotFoundException);
    });
  });

  describe('crearDireccion()', () => {
    it('rechaza una provincia inexistente', async () => {
      mockProvinciaRepo.findOneBy.mockResolvedValue(null);
      await expect(service.crearDireccion(3, dtoDireccion as any)).rejects.toThrow(BadRequestException);
      expect(manager.transaction).not.toHaveBeenCalled();
    });

    it('normaliza los textos y deja la primera dirección como predeterminada', async () => {
      mockProvinciaRepo.findOneBy.mockResolvedValue({ id_provincia: 5 });
      manager.count.mockResolvedValue(0);
      manager.save.mockImplementation(async (_e: any, d: any) => d);

      const res: any = await service.crearDireccion(3, dtoDireccion as any);

      expect(res.nombre_destinatario).toBe('Valentina Rojas');
      expect(res.codigo_postal).toBe('X5000ABC');
      expect(res.observaciones).toBeNull();
      expect(res.id_usuario).toBe(3);
      expect(res.es_predeterminada).toBe(true);
    });

    it('si pide ser predeterminada, desmarca la anterior', async () => {
      mockProvinciaRepo.findOneBy.mockResolvedValue({ id_provincia: 5 });
      manager.count.mockResolvedValue(2);
      manager.save.mockImplementation(async (_e: any, d: any) => d);

      const res: any = await service.crearDireccion(3, { ...dtoDireccion, es_predeterminada: true } as any);

      expect(manager.update).toHaveBeenCalledWith(DireccionEnvio, { id_usuario: 3, es_predeterminada: true }, { es_predeterminada: false });
      expect(res.es_predeterminada).toBe(true);
    });

    it('una dirección adicional sin pedirlo no es predeterminada', async () => {
      mockProvinciaRepo.findOneBy.mockResolvedValue({ id_provincia: 5 });
      manager.count.mockResolvedValue(1);
      manager.save.mockImplementation(async (_e: any, d: any) => d);

      const res: any = await service.crearDireccion(3, dtoDireccion as any);

      expect(manager.update).not.toHaveBeenCalled();
      expect(res.es_predeterminada).toBe(false);
    });

    it('traduce el error de BD por código postal inválido a BadRequestException', async () => {
      mockProvinciaRepo.findOneBy.mockResolvedValue({ id_provincia: 5 });
      manager.transaction.mockRejectedValue(
        new QueryFailedError('insert', [], { code: '23514', constraint: 'ck_direccion_codigo_postal' } as any),
      );
      await expect(service.crearDireccion(3, dtoDireccion as any)).rejects.toThrow(
        'Código postal inválido (ej: 1425 o C1425ABC)',
      );
    });
  });

  describe('actualizarDireccion()', () => {
    it('lanza NotFoundException si la dirección no es del usuario', async () => {
      mockDireccionRepo.findOne.mockResolvedValue(null);
      await expect(service.actualizarDireccion(3, 99, { calle: 'San Martín' } as any)).rejects.toThrow(NotFoundException);
    });

    it('rechaza una provincia inexistente', async () => {
      mockDireccionRepo.findOne.mockResolvedValue({ id_direccion: 10 });
      mockProvinciaRepo.findOneBy.mockResolvedValue(null);
      await expect(service.actualizarDireccion(3, 10, { id_provincia: 77 } as any)).rejects.toThrow(BadRequestException);
    });

    it('actualiza los campos, convierte vacíos en null y devuelve la dirección actualizada', async () => {
      mockDireccionRepo.findOne.mockResolvedValue({ id_direccion: 10, calle: 'Bv. Oroño' });
      await service.actualizarDireccion(3, 10, { calle: ' Bv.  Oroño ', piso_depto: '' } as any);

      expect(manager.update).toHaveBeenCalledWith(
        DireccionEnvio,
        { id_direccion: 10, id_usuario: 3 },
        expect.objectContaining({ calle: 'Bv. Oroño', piso_depto: null }),
      );
    });

    it('al marcarla predeterminada desmarca las demás del usuario', async () => {
      mockDireccionRepo.findOne.mockResolvedValue({ id_direccion: 10 });
      await service.actualizarDireccion(3, 10, { es_predeterminada: true } as any);
      expect(manager.update).toHaveBeenCalledWith(DireccionEnvio, { id_usuario: 3, es_predeterminada: true }, { es_predeterminada: false });
      expect(manager.update).toHaveBeenCalledWith(
        DireccionEnvio,
        { id_direccion: 10, id_usuario: 3 },
        expect.objectContaining({ es_predeterminada: true }),
      );
    });

    it('traduce un conflicto de unicidad a ConflictException', async () => {
      mockDireccionRepo.findOne.mockResolvedValue({ id_direccion: 10 });
      manager.transaction.mockRejectedValue(new QueryFailedError('update', [], { code: '23505' } as any));
      await expect(service.actualizarDireccion(3, 10, { calle: 'X' } as any)).rejects.toThrow(ConflictException);
    });
  });

  describe('tarifas', () => {
    it('listarTarifas() incluye la provincia', async () => {
      mockTarifaRepo.find.mockResolvedValue([]);
      await service.listarTarifas();
      expect(mockTarifaRepo.find).toHaveBeenCalledWith(expect.objectContaining({ relations: { provincia: true } }));
    });

    const antes = () => ({ id_tarifa: 2, precio: '5800.00', plazo_dias: 3, activa: true, provincia: { nombre: 'Córdoba' } });

    it('actualizarTarifa() lanza NotFoundException si no existe', async () => {
      mockTarifaRepo.findOne.mockResolvedValue(null);
      await expect(service.actualizarTarifa(99, { precio: 1000 } as any, 1)).rejects.toThrow(NotFoundException);
    });

    it('sin cambios devuelve la tarifa actual sin actualizar ni auditar', async () => {
      mockTarifaRepo.findOne.mockResolvedValue(antes());
      const res = await service.actualizarTarifa(2, {} as any, 1);
      expect(res).toMatchObject({ id_tarifa: 2 });
      expect(mockTarifaRepo.update).not.toHaveBeenCalled();
      expect(mockAuditoria.registrar).not.toHaveBeenCalled();
    });

    it('al cambiar el precio audita solo lo que cambió, con el nombre de la provincia', async () => {
      mockTarifaRepo.findOne.mockResolvedValue(antes());
      mockTarifaRepo.findOneOrFail.mockResolvedValue({ ...antes(), precio: '6400' });

      await service.actualizarTarifa(2, { precio: 6400, plazo_dias: 3 } as any, 1);

      expect(mockTarifaRepo.update).toHaveBeenCalledWith(2, { precio: '6400', plazo_dias: 3 });
      expect(mockAuditoria.registrar).toHaveBeenCalledWith({
        id_usuario: 1,
        accion: AccionAuditoria.EDITAR,
        entidad: 'TarifaEnvio',
        id_entidad: 2,
        datos_anteriores: { provincia: 'Córdoba', precio: '5800.00' },
        datos_nuevos: { provincia: 'Córdoba', precio: '6400' },
      });
    });

    it('no audita si el valor enviado es igual al que ya tenía', async () => {
      mockTarifaRepo.findOne.mockResolvedValue(antes());
      mockTarifaRepo.findOneOrFail.mockResolvedValue(antes());
      await service.actualizarTarifa(2, { activa: true } as any, 1);
      expect(mockAuditoria.registrar).not.toHaveBeenCalled();
    });

    it('traduce el error de BD por precio negativo', async () => {
      mockTarifaRepo.findOne.mockResolvedValue(antes());
      mockTarifaRepo.update.mockRejectedValue(
        new QueryFailedError('update', [], { code: '23514', constraint: 'ck_tarifa_precio' } as any),
      );
      await expect(service.actualizarTarifa(2, { precio: -5 } as any, 1)).rejects.toThrow(
        'El precio no puede ser negativo',
      );
    });
  });

  describe('calcularCosto()', () => {
    it('retiro en local: costo cero cuando está activo', async () => {
      configurar({ retiro_local_activo: 'true' });
      const res = await service.calcularCosto({ tipo_entrega: 'retiro', subtotal: 48900 });
      expect(res).toMatchObject({ tipo_entrega: 'retiro', costo: 0, plazo_dias: null });
    });

    it('retiro en local: error si está desactivado', async () => {
      configurar({ retiro_local_activo: 'false' });
      await expect(service.calcularCosto({ tipo_entrega: 'retiro', subtotal: 48900 })).rejects.toThrow(
        'El retiro en local no está disponible',
      );
    });

    it('domicilio sin provincia lanza BadRequestException', async () => {
      configurar({});
      await expect(service.calcularCosto({ tipo_entrega: 'domicilio', subtotal: 1000 })).rejects.toThrow(BadRequestException);
    });

    it('domicilio con tarifa activa usa su precio y plazo', async () => {
      configurar({});
      mockTarifaRepo.findOne.mockResolvedValue({ precio: '5800.00', plazo_dias: 3 });
      const res = await service.calcularCosto({ tipo_entrega: 'domicilio', id_provincia: 5, subtotal: 48900 });
      expect(res).toEqual({
        tipo_entrega: 'domicilio',
        costo: 5800,
        envio_gratis: false,
        plazo_dias: 3,
        detalle: 'Envío a domicilio',
      });
    });

    it('domicilio sin tarifa usa el precio base de la configuración', async () => {
      configurar({ envio_precio_base: '7500' });
      mockTarifaRepo.findOne.mockResolvedValue(null);
      const res = await service.calcularCosto({ tipo_entrega: 'domicilio', id_provincia: 9, subtotal: 20000 });
      expect(res.costo).toBe(7500);
      expect(res.plazo_dias).toBeNull();
    });

    it('envío gratis al llegar al monto mínimo configurado', async () => {
      configurar({ envio_gratis_desde: '90000' });
      mockTarifaRepo.findOne.mockResolvedValue({ precio: '5800', plazo_dias: 3 });
      const res = await service.calcularCosto({ tipo_entrega: 'domicilio', id_provincia: 5, subtotal: 90000 });
      expect(res).toMatchObject({ costo: 0, envio_gratis: true, detalle: 'Envío gratis' });
    });

    it('no hay envío gratis si el umbral es 0 (desactivado) o no se alcanza', async () => {
      configurar({ envio_gratis_desde: '0' });
      mockTarifaRepo.findOne.mockResolvedValue({ precio: '5800', plazo_dias: 3 });
      const a = await service.calcularCosto({ tipo_entrega: 'domicilio', id_provincia: 5, subtotal: 999999 });
      expect(a.envio_gratis).toBe(false);

      configurar({ envio_gratis_desde: '90000' });
      const b = await service.calcularCosto({ tipo_entrega: 'domicilio', id_provincia: 5, subtotal: 89999 });
      expect(b.envio_gratis).toBe(false);
    });

    it('redondea el costo a dos decimales', async () => {
      configurar({});
      mockTarifaRepo.findOne.mockResolvedValue({ precio: '5800.456', plazo_dias: 3 });
      const res = await service.calcularCosto({ tipo_entrega: 'domicilio', id_provincia: 5, subtotal: 1000 });
      expect(res.costo).toBe(5800.46);
    });
  });
});
