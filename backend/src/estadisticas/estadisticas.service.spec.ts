import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { EstadisticasService } from './estadisticas.service';
import { ConfiguracionService } from '../configuracion/configuracion.service';

describe('EstadisticasService', () => {
  let service: EstadisticasService;
  const mockDataSource = { query: jest.fn() };
  const mockConfiguracion = { obtenerNumero: jest.fn() };

  beforeEach(async () => {
    jest.resetAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EstadisticasService,
        { provide: DataSource, useValue: mockDataSource },
        { provide: ConfiguracionService, useValue: mockConfiguracion },
      ],
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
  describe('periodoAnterior()', () => {
    it('devuelve el tramo inmediato anterior de la misma duración', () => {
      expect(service.periodoAnterior({ desde: '2026-11-01', hasta: '2026-11-30' })).toEqual({
        desde: '2026-10-02',
        hasta: '2026-10-31',
      });
    });

    it('para un solo día devuelve el día anterior', () => {
      expect(service.periodoAnterior({ desde: '2026-11-10', hasta: '2026-11-10' })).toEqual({
        desde: '2026-11-09',
        hasta: '2026-11-09',
      });
    });
  });

  describe('panelVentas()', () => {
    const rango = { desde: '2026-11-01', hasta: '2026-11-02' };

    it('arma KPIs, series y estados, y compara con el período anterior', async () => {
      mockDataSource.query
        .mockResolvedValueOnce([{ cantidad: '2', monto_productos: '1000', monto_envio: '200' }]) // actual resumen
        .mockResolvedValueOnce([{ periodo: '2026-11-01', cantidad: '1', monto_productos: '500', monto_envio: '100' }]) // actual serie
        .mockResolvedValueOnce([{ cantidad: '1', monto_productos: '400', monto_envio: '0' }]) // previo resumen
        .mockResolvedValueOnce([{ periodo: '2026-10-30', cantidad: '1', monto_productos: '400', monto_envio: '0' }]) // previo serie
        .mockResolvedValueOnce([
          { estado: 'confirmada', cantidad: '2', importe: '1200' },
          { estado: 'pendiente', cantidad: '3', importe: '900' },
        ]) // estados actual
        .mockResolvedValueOnce([{ estado: 'pendiente', cantidad: '1', importe: '100' }]); // estados previo

      const r = await service.panelVentas(rango);

      expect(r.anterior).toEqual({ desde: '2026-10-30', hasta: '2026-10-31' });
      expect(r.actual).toMatchObject({ cantidad: 2, monto_total: 1200, ticket_promedio: 600, pendientes: 3 });
      expect(r.previo).toMatchObject({ cantidad: 1, monto_total: 400, pendientes: 1 });
      expect(r.serie_actual).toEqual([{ periodo: '2026-11-01', cantidad: 1, monto: 600 }]);
      expect(r.serie_anterior).toEqual([{ periodo: '2026-10-30', cantidad: 1, monto: 400 }]);
    });

    it('devuelve siempre los tres estados aunque no haya operaciones', async () => {
      mockDataSource.query
        .mockResolvedValueOnce([{ cantidad: '0', monto_productos: '0', monto_envio: '0' }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ cantidad: '0', monto_productos: '0', monto_envio: '0' }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const r = await service.panelVentas(rango);

      expect(r.estados).toEqual([
        { estado: 'confirmada', cantidad: 0, importe: 0 },
        { estado: 'pendiente', cantidad: 0, importe: 0 },
        { estado: 'cancelada', cantidad: 0, importe: 0 },
      ]);
      expect(r.actual.ticket_promedio).toBe(0);
    });
  });

  describe('panelProductos()', () => {
    it('clasifica las variantes con el stock mínimo configurado', async () => {
      mockConfiguracion.obtenerNumero.mockResolvedValue(5);
      mockDataSource.query
        .mockResolvedValueOnce([{ unidades: '12', productos: '4' }])
        .mockResolvedValueOnce([{ id_producto: 1, nombre: 'Anillo', unidades: '7' }])
        .mockResolvedValueOnce([{ id_producto: 2, nombre: 'Collar', unidades: '0' }])
        .mockResolvedValueOnce([
          { id_variante: 1, producto: 'Anillo', stock_disponible: 0, material: 'Plata', medida: '16' },
          { id_variante: 2, producto: 'Anillo', stock_disponible: 5, material: null, medida: null },
          { id_variante: 3, producto: 'Collar', stock_disponible: 6, material: 'Oro', medida: '45 cm' },
        ]);

      const r = await service.panelProductos({ desde: '2026-11-01', hasta: '2026-11-30' });

      expect(mockConfiguracion.obtenerNumero).toHaveBeenCalledWith('stock_minimo', 3);
      expect(r.umbral).toBe(5);
      expect(r.unidades_vendidas).toBe(12);
      expect(r.productos_con_ventas).toBe(4);
      expect(r.variantes_sin_stock).toBe(1);
      expect(r.variantes_stock_bajo).toBe(1);
      expect(r.variantes.map((v) => v.estado)).toEqual(['sin_stock', 'stock_bajo', 'ok']);
      expect(r.variantes[1]).toMatchObject({ material: '—', medida: '—' });
      expect(r.mas_vendidos).toEqual([{ id_producto: 1, nombre: 'Anillo', unidades: 7 }]);
      expect(r.menos_vendidos).toEqual([{ id_producto: 2, nombre: 'Collar', unidades: 0 }]);
    });
  });

  describe('panelClientes()', () => {
    it('cuenta compradores y recurrentes y calcula lo que falta para el próximo nivel', async () => {
      mockDataSource.query
        .mockResolvedValueOnce([
          { compras: '1', clientes: '5' },
          { compras: '2', clientes: '2' },
          { compras: '4', clientes: '1' },
        ]) // actual
        .mockResolvedValueOnce([{ compras: '1', clientes: '3' }]) // previo
        .mockResolvedValueOnce([{ registrados: '40', vip: '6' }])
        .mockResolvedValueOnce([
          { nombre_nivel: 'Bronce', monto_min_requerido: '100000', cantidad_compras_min_requerida: '3', clientes: '4' },
          { nombre_nivel: 'Plata', monto_min_requerido: '300000', cantidad_compras_min_requerida: '6', clientes: '2' },
        ])
        .mockResolvedValueOnce([
          {
            id_usuario: 9, nombre: 'Ana', apellido: 'Paz', compras: '4', importe: '150000',
            nombre_nivel: 'Bronce', nivel_monto_min: '100000', compras_historicas: '4', monto_historico: '120000',
          },
        ]);

      const r = await service.panelClientes({ desde: '2026-11-01', hasta: '2026-11-30' });

      expect(r).toMatchObject({
        registrados: 40, cumplen_vip: 6, compraron: 8, recurrentes: 3, compraron_anterior: 3, recurrentes_anterior: 0,
      });
      expect(r.frecuencia).toEqual([
        { etiqueta: '1 compra', clientes: 5 },
        { etiqueta: '2 compras', clientes: 2 },
        { etiqueta: '3 o más compras', clientes: 1 },
      ]);
      expect(r.por_nivel[0]).toEqual({ nivel: 'Bronce', clientes: 4, monto_min: 100000, compras_min: 3 });
      expect(r.top_clientes[0]).toEqual({
        id_usuario: 9, nombre: 'Ana Paz', nivel: 'Bronce', compras: 4, importe: 150000,
        proximo_nivel: 'Plata', faltan_compras: 2, faltan_monto: 180000,
      });
    });

    it('un cliente sin nivel apunta al primer nivel', async () => {
      mockDataSource.query
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ registrados: '1', vip: '0' }])
        .mockResolvedValueOnce([
          { nombre_nivel: 'Bronce', monto_min_requerido: '100000', cantidad_compras_min_requerida: '3', clientes: '0' },
        ])
        .mockResolvedValueOnce([
          {
            id_usuario: 1, nombre: 'Lu', apellido: 'Gil', compras: '1', importe: '5000',
            nombre_nivel: null, nivel_monto_min: null, compras_historicas: '1', monto_historico: '5000',
          },
        ]);

      const r = await service.panelClientes({ desde: '2026-11-01', hasta: '2026-11-30' });

      expect(r.top_clientes[0]).toMatchObject({ nivel: 'Sin nivel', proximo_nivel: 'Bronce', faltan_compras: 2, faltan_monto: 95000 });
    });
  });

  describe('panelRescate()', () => {
    it('calcula la tasa de recuperación como recuperados ÷ abandonados × 100', async () => {
      mockDataSource.query
        .mockResolvedValueOnce([{ abandonados: '8', notificados: '6', recuperados: '2', monto: '90000' }])
        .mockResolvedValueOnce([{ abandonados: '0', notificados: '0', recuperados: '0', monto: '0' }])
        .mockResolvedValueOnce([
          { nombre: 'Ana', apellido: 'Paz', fecha_aviso: '2026-11-03T12:00:00Z', fecha_compra: '2026-11-04T15:30:00Z', monto: '45000' },
        ]);

      const r = await service.panelRescate({ desde: '2026-11-01', hasta: '2026-11-30' });

      expect(r.actual).toEqual({
        abandonados: 8, notificados: 6, recuperados: 2, monto_recuperado: 90000, tasa_recuperacion: 25,
      });
      expect(r.previo.tasa_recuperacion).toBe(0);
      expect(r.ventas_recuperadas).toEqual([
        { cliente: 'Ana Paz', fecha_aviso: '2026-11-03T12:00:00.000Z', fecha_compra: '2026-11-04T15:30:00.000Z', monto: 45000 },
      ]);
    });
  });
});
