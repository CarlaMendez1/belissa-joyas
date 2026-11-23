import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { DashboardService, STOCK_MINIMO } from './dashboard.service';
import { ConfiguracionService } from '../configuracion/configuracion.service';

// Responde cada consulta según un fragmento único de su SQL
type Respuestas = Array<[string, unknown]>;

describe('DashboardService', () => {
  let service: DashboardService;
  const mockDataSource = { query: jest.fn() };
  const mockConfiguracion = { obtenerNumero: jest.fn() };

  const FECHA = new Date('2026-11-10T15:30:00Z');

  const base = (): Respuestas => [
    ['monto_anterior', [{ cantidad: '12', monto: '1450000', monto_anterior: '1000000' }]],
    ['COUNT(*) FILTER (WHERE estado = \'activo\')', [{ total: '48', nuevos_mes: '6' }]],
    ['FROM cliente_vip cv', [{ total: '7', nuevos_mes: '2' }]],
    ['COUNT(*) FILTER (WHERE va.stock_disponible <= 0)', [{ total: '4', sin_stock: '1' }]],
    ['SELECT va.id_variante, p.id_producto', [
      { id_variante: '11', id_producto: '3', nombre: 'Anillo solitario plata 925', stock_disponible: '0', detalle: 'Talle 16 · Plata' },
      { id_variante: '14', id_producto: '5', nombre: 'Collar corazón acero', stock_disponible: '2', detalle: '45 cm' },
    ]],
    ['COUNT(*) OVER () AS total', [
      { id_venta: '105', nombre: 'Valentina', apellido: 'Rojas', tipo_entrega: 'envio', envio_provincia: 'Córdoba', estado_envio: 'pendiente_despacho', fecha_compra: FECHA, total: '3' },
      { id_venta: '104', nombre: 'Mariano', apellido: 'Giménez', tipo_entrega: 'retiro', envio_provincia: null, estado_envio: 'retiro_listo', fecha_compra: FECHA, total: '3' },
    ]],
    ['AS producto,\n', [
      { id_venta: '105', nombre: 'Valentina', apellido: 'Rojas', fecha_compra: FECHA, monto: '84900', producto: 'Pulsera cadena doble', productos: '3' },
      { id_venta: '104', nombre: 'Mariano', apellido: 'Giménez', fecha_compra: FECHA, monto: '48900', producto: null, productos: '0' },
    ]],
    ['SELECT COUNT(*) AS total\n         FROM carrito c\n        WHERE c.estado', [{ total: '5' }]],
    ['mail_enviado', [
      { id_carrito: '30', nombre: 'Lucía', apellido: 'Paz', fecha_ultima_act: FECHA, productos: '2', monto: '63700', mail_enviado: true },
      { id_carrito: '31', nombre: 'Julián', apellido: 'Ortiz', fecha_ultima_act: FECHA, productos: '1', monto: '27500', mail_enviado: false },
    ]],
    ['generate_series', [
      { dia: '2026-11-09', monto: '0' },
      { dia: '2026-11-10', monto: '133800' },
    ]],
    ['AS categoria', [
      { categoria: 'Anillos', monto: '97800' },
      { categoria: 'Collares', monto: '55000' },
    ]],
    ['fecha_entrega', [{ total: '9' }]],
    ['AS total\n         FROM carrito c\n        WHERE', [{ total: '40' }]],
  ];

  const conectar = (respuestas: Respuestas) => {
    mockDataSource.query.mockImplementation(async (sql: string) => {
      const hit = respuestas.find(([frag]) => sql.includes(frag));
      if (!hit) throw new Error(`Consulta sin mock: ${sql.slice(0, 60)}`);
      return hit[1];
    });
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: DataSource, useValue: mockDataSource },
        { provide: ConfiguracionService, useValue: mockConfiguracion },
      ],
    }).compile();
    service = module.get(DashboardService);
    jest.clearAllMocks();
    // Sin cambios del administrador, rige el valor por defecto
    mockConfiguracion.obtenerNumero.mockImplementation(async (_clave: string, porDefecto: number) => porDefecto);
  });

  it('el umbral de stock crítico es de 3 unidades', () => {
    expect(STOCK_MINIMO).toBe(3);
  });

  describe('obtenerResumen()', () => {
    // El orden de las consultas depende del servicio: se resuelve por fragmento de SQL
    const resumenConMocks = async (overrides: Respuestas = []) => {
      const mapa = new Map<string, unknown>(base());
      overrides.forEach(([k, v]) => mapa.set(k, v));
      conectar([...mapa.entries()]);
      return service.obtenerResumen();
    };

    it('devuelve todas las secciones del panel', async () => {
      const r = await resumenConMocks();
      expect(Object.keys(r).sort()).toEqual([
        'carritos_abandonados', 'clientes_vip', 'ingresos_por_categoria', 'pedidos_entregados_mes',
        'pedidos_por_despachar', 'stock_critico', 'tasa_conversion', 'ultimas_ventas',
        'usuarios_activos', 'ventas_30_dias', 'ventas_mes',
      ]);
    });

    it('ventas del mes: convierte a número y calcula la variación contra el mes anterior', async () => {
      const r = await resumenConMocks();
      expect(r.ventas_mes).toEqual({ cantidad: 12, monto: 1450000, monto_anterior: 1000000, variacion_porcentaje: 45 });
    });

    it('ventas del mes: la variación es null si el mes anterior no tuvo ventas', async () => {
      const r = await resumenConMocks([['monto_anterior', [{ cantidad: '3', monto: '120000', monto_anterior: '0' }]]]);
      expect(r.ventas_mes.variacion_porcentaje).toBeNull();
    });

    it('ventas del mes: sin ventas devuelve todo en cero', async () => {
      const r = await resumenConMocks([['monto_anterior', [{ cantidad: '0', monto: null, monto_anterior: null }]]]);
      expect(r.ventas_mes).toEqual({ cantidad: 0, monto: 0, monto_anterior: 0, variacion_porcentaje: null });
    });

    it('usuarios activos y clientes VIP: totales y nuevos del mes', async () => {
      const r = await resumenConMocks();
      expect(r.usuarios_activos).toEqual({ total: 48, nuevos_mes: 6 });
      expect(r.clientes_vip).toEqual({ total: 7, nuevos_mes: 2 });
    });

    it('stock crítico: informa umbral, total, sin stock y los ítems ordenados', async () => {
      const r = await resumenConMocks();
      expect(r.stock_critico.umbral).toBe(3);
      expect(r.stock_critico.total).toBe(4);
      expect(r.stock_critico.sin_stock).toBe(1);
      expect(r.stock_critico.items[0]).toEqual({
        id_variante: 11, id_producto: 3, nombre: 'Anillo solitario plata 925', detalle: 'Talle 16 · Plata', stock: 0,
      });
      expect(mockDataSource.query).toHaveBeenCalledWith(expect.stringContaining('stock_disponible <= $1'), [STOCK_MINIMO]);
    });

    it('stock crítico: usa el stock mínimo configurado por el administrador', async () => {
      mockConfiguracion.obtenerNumero.mockResolvedValue(10);
      const r = await resumenConMocks();
      expect(mockConfiguracion.obtenerNumero).toHaveBeenCalledWith('stock_minimo', STOCK_MINIMO);
      expect(r.stock_critico.umbral).toBe(10);
      expect(mockDataSource.query).toHaveBeenCalledWith(expect.stringContaining('stock_disponible <= $1'), [10]);
    });

    it('pedidos por despachar: arma el nombre del cliente y la provincia (null en retiro)', async () => {
      const r = await resumenConMocks();
      expect(r.pedidos_por_despachar.total).toBe(3);
      expect(r.pedidos_por_despachar.items[0]).toMatchObject({ id_venta: 105, cliente: 'Valentina Rojas', provincia: 'Córdoba', tipo_entrega: 'envio' });
      expect(r.pedidos_por_despachar.items[1]).toMatchObject({ cliente: 'Mariano Giménez', provincia: null, estado_envio: 'retiro_listo' });
    });

    it('pedidos por despachar: sin pedidos el total es 0', async () => {
      const r = await resumenConMocks([['COUNT(*) OVER () AS total', []]]);
      expect(r.pedidos_por_despachar).toEqual({ total: 0, items: [] });
    });

    it('últimas ventas: calcula "otros productos" sin bajar de cero', async () => {
      const r = await resumenConMocks();
      expect(r.ultimas_ventas[0]).toMatchObject({ id_venta: 105, producto: 'Pulsera cadena doble', otros_productos: 2, monto: 84900 });
      expect(r.ultimas_ventas[1]).toMatchObject({ producto: null, otros_productos: 0 });
    });

    it('carritos abandonados: total, ítems y si ya se envió el mail', async () => {
      const r = await resumenConMocks();
      expect(r.carritos_abandonados.total).toBe(5);
      expect(r.carritos_abandonados.items).toHaveLength(2);
      expect(r.carritos_abandonados.items[0]).toMatchObject({ id_carrito: 30, cliente: 'Lucía Paz', productos: 2, monto: 63700, mail_enviado: true });
      expect(r.carritos_abandonados.items[1].mail_enviado).toBe(false);
    });

    it('serie de 30 días: números por día, los días sin ventas valen 0', async () => {
      const r = await resumenConMocks();
      expect(r.ventas_30_dias).toEqual([{ dia: '2026-11-09', monto: 0 }, { dia: '2026-11-10', monto: 133800 }]);
    });

    it('ingresos por categoría: devuelve categoría y monto numérico', async () => {
      const r = await resumenConMocks();
      expect(r.ingresos_por_categoria).toEqual([{ categoria: 'Anillos', monto: 97800 }, { categoria: 'Collares', monto: 55000 }]);
    });

    it('pedidos entregados del mes', async () => {
      const r = await resumenConMocks();
      expect(r.pedidos_entregados_mes).toBe(9);
    });

    it('tasa de conversión: ventas del mes sobre carritos con actividad (12 de 40 = 30%)', async () => {
      const r = await resumenConMocks();
      expect(r.tasa_conversion).toEqual({ carritos: 40, porcentaje: 30 });
    });

    it('tasa de conversión: sin carritos devuelve porcentaje null', async () => {
      const r = await resumenConMocks([['AS total\n         FROM carrito c\n        WHERE', [{ total: '0' }]]]);
      expect(r.tasa_conversion).toEqual({ carritos: 0, porcentaje: null });
    });

    it('tasa de conversión: nunca supera el 100%', async () => {
      const r = await resumenConMocks([['AS total\n         FROM carrito c\n        WHERE', [{ total: '5' }]]]);
      expect(r.tasa_conversion.porcentaje).toBe(100);
    });

    it('propaga el error si falla la base de datos', async () => {
      mockDataSource.query.mockRejectedValue(new Error('conexión perdida'));
      await expect(service.obtenerResumen()).rejects.toThrow('conexión perdida');
    });
  });
});
