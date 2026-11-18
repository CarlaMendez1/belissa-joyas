import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { EstadisticasService } from './estadisticas.service';

describe('EstadisticasService', () => {
  let service: EstadisticasService;
  const mockDataSource = { query: jest.fn() };

  beforeEach(async () => {
    jest.resetAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [EstadisticasService, { provide: DataSource, useValue: mockDataSource }],
    }).compile();
    service = module.get(EstadisticasService);
  });

  afterEach(() => jest.useRealTimers());

  describe('resolverRango()', () => {
    it('sin fechas usa los últimos 30 días hasta hoy (hora de Argentina)', () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-11-17T01:00:00Z')); // 16/11 22:00 en Argentina
      expect(service.resolverRango()).toEqual({ desde: '2026-10-18', hasta: '2026-11-16' });
    });

    it('respeta el rango pedido', () => {
      expect(service.resolverRango('2026-10-01', '2026-10-31')).toEqual({ desde: '2026-10-01', hasta: '2026-10-31' });
    });

    it('solo con "hasta" calcula 30 días hacia atrás', () => {
      expect(service.resolverRango(undefined, '2026-03-31')).toEqual({ desde: '2026-03-02', hasta: '2026-03-31' });
    });

    it('rechaza fechas con formato inválido', () => {
      expect(() => service.resolverRango('10/10/2026', '2026-10-31')).toThrow(BadRequestException);
    });

    it('rechaza fechas que no existen en el calendario', () => {
      expect(() => service.resolverRango('2026-02-30', '2026-03-10')).toThrow(BadRequestException);
    });

    it('rechaza un "desde" posterior al "hasta"', () => {
      expect(() => service.resolverRango('2026-11-10', '2026-11-01')).toThrow(BadRequestException);
    });

    it('rechaza períodos de más de 3 años', () => {
      expect(() => service.resolverRango('2020-01-01', '2026-01-01')).toThrow(BadRequestException);
    });

    it('acepta un solo día', () => {
      expect(service.resolverRango('2026-11-10', '2026-11-10')).toEqual({ desde: '2026-11-10', hasta: '2026-11-10' });
    });
  });

  describe('resolverAgrupacion()', () => {
    it('por defecto agrupa por día', () => {
      expect(service.resolverAgrupacion()).toBe('dia');
    });

    it.each(['dia', 'semana', 'mes'])('acepta "%s"', (valor) => {
      expect(service.resolverAgrupacion(valor)).toBe(valor);
    });

    it('rechaza una agrupación inválida', () => {
      expect(() => service.resolverAgrupacion('año')).toThrow(BadRequestException);
    });
  });

  describe('ventas()', () => {
    const rango = { desde: '2026-11-01', hasta: '2026-11-03' };

    it('calcula montos, total y ticket promedio, y convierte todo a número', async () => {
      mockDataSource.query
        .mockResolvedValueOnce([{ cantidad: '4', monto_productos: '200000', monto_envio: '16000' }])
        .mockResolvedValueOnce([
          { periodo: '2026-11-01', cantidad: '1', monto_productos: '50000', monto_envio: '4000' },
          { periodo: '2026-11-02', cantidad: '0', monto_productos: '0', monto_envio: '0' },
        ]);

      const r = await service.ventas(rango, 'dia');

      expect(r.resumen).toEqual({
        cantidad: 4,
        monto_productos: 200000,
        monto_envio: 16000,
        monto_total: 216000,
        ticket_promedio: 54000,
      });
      expect(r.serie).toEqual([
        { periodo: '2026-11-01', cantidad: 1, monto: 54000 },
        { periodo: '2026-11-02', cantidad: 0, monto: 0 },
      ]);
    });

    it('sin ventas devuelve ceros y ticket promedio 0 (sin dividir por cero)', async () => {
      mockDataSource.query
        .mockResolvedValueOnce([{ cantidad: '0', monto_productos: null, monto_envio: null }])
        .mockResolvedValueOnce([]);
      const r = await service.ventas(rango, 'dia');
      expect(r.resumen.ticket_promedio).toBe(0);
      expect(r.resumen.monto_total).toBe(0);
      expect(r.serie).toEqual([]);
    });

    it('redondea el ticket promedio a dos decimales', async () => {
      mockDataSource.query
        .mockResolvedValueOnce([{ cantidad: '3', monto_productos: '100000', monto_envio: '0' }])
        .mockResolvedValueOnce([]);
      const r = await service.ventas(rango, 'dia');
      expect(r.resumen.ticket_promedio).toBe(33333.33);
    });

    it('usa la unidad de tiempo según la agrupación y pasa el rango como parámetros', async () => {
      mockDataSource.query
        .mockResolvedValueOnce([{ cantidad: '0', monto_productos: '0', monto_envio: '0' }])
        .mockResolvedValueOnce([]);
      await service.ventas(rango, 'mes');
      const [sqlSerie, params] = mockDataSource.query.mock.calls[1];
      expect(sqlSerie).toContain("date_trunc('month'");
      expect(params).toEqual(['2026-11-01', '2026-11-03']);
    });

    it('solo cuenta ventas confirmadas', async () => {
      mockDataSource.query
        .mockResolvedValueOnce([{ cantidad: '0', monto_productos: '0', monto_envio: '0' }])
        .mockResolvedValueOnce([]);
      await service.ventas(rango, 'dia');
      expect(mockDataSource.query.mock.calls[0][0]).toContain("estado_compra = 'confirmada'");
    });
  });

  describe('productos()', () => {
    it('devuelve más vendidos y ventas por categoría con números', async () => {
      mockDataSource.query
        .mockResolvedValueOnce([{ id_producto: '3', nombre: 'Anillo solitario plata 925', unidades: '5', monto: '244500' }])
        .mockResolvedValueOnce([{ categoria: 'Anillos', unidades: '5', monto: '244500' }]);

      const r = await service.productos({ desde: '2026-11-01', hasta: '2026-11-30' });

      expect(r.mas_vendidos).toEqual([{ id_producto: 3, nombre: 'Anillo solitario plata 925', unidades: 5, monto: 244500 }]);
      expect(r.por_categoria).toEqual([{ categoria: 'Anillos', unidades: 5, monto: 244500 }]);
    });

    it('limita el ranking a 10 productos', async () => {
      mockDataSource.query.mockResolvedValue([]);
      await service.productos({ desde: '2026-11-01', hasta: '2026-11-30' });
      expect(mockDataSource.query.mock.calls[0][0]).toContain('LIMIT 10');
    });

    it('sin ventas devuelve listas vacías', async () => {
      mockDataSource.query.mockResolvedValue([]);
      const r = await service.productos({ desde: '2026-11-01', hasta: '2026-11-30' });
      expect(r.mas_vendidos).toEqual([]);
      expect(r.por_categoria).toEqual([]);
    });
  });

  describe('envios()', () => {
    const rango = { desde: '2026-11-01', hasta: '2026-11-30' };

    it('arma tipo de entrega, provincias, estados y tiempos redondeados a un decimal', async () => {
      mockDataSource.query
        .mockResolvedValueOnce([{ tipo: 'domicilio', cantidad: '8', monto_envio: '46400', gratis: '2' }])
        .mockResolvedValueOnce([{ provincia: 'Córdoba', cantidad: '5', monto: '300000' }])
        .mockResolvedValueOnce([{ estado: 'entregado', cantidad: '6' }])
        .mockResolvedValueOnce([{ horas_hasta_despacho: '26.349', dias_hasta_entrega: '3.96' }]);

      const r = await service.envios(rango);

      expect(r.por_tipo).toEqual([{ tipo: 'domicilio', cantidad: 8, monto_envio: 46400, con_envio_gratis: 2 }]);
      expect(r.por_provincia).toEqual([{ provincia: 'Córdoba', cantidad: 5, monto: 300000 }]);
      expect(r.por_estado).toEqual([{ estado: 'entregado', cantidad: 6 }]);
      expect(r.horas_hasta_despacho).toBe(26.3);
      expect(r.dias_hasta_entrega).toBe(4);
    });

    it('sin pedidos despachados los tiempos son null', async () => {
      mockDataSource.query
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ horas_hasta_despacho: null, dias_hasta_entrega: null }]);
      const r = await service.envios(rango);
      expect(r.horas_hasta_despacho).toBeNull();
      expect(r.dias_hasta_entrega).toBeNull();
    });

    it('solo considera pedidos con tipo de entrega (excluye ventas viejas)', async () => {
      mockDataSource.query.mockResolvedValue([{}]);
      await service.envios(rango);
      expect(mockDataSource.query.mock.calls[0][0]).toContain('tipo_entrega IS NOT NULL');
    });

    it('propaga el error si falla la base de datos', async () => {
      mockDataSource.query.mockRejectedValue(new Error('conexión perdida'));
      await expect(service.envios(rango)).rejects.toThrow('conexión perdida');
    });
  });
});
