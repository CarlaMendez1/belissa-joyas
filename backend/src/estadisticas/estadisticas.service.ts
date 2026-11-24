import { Injectable, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ConfiguracionService } from '../configuracion/configuracion.service.js';

const ZONA = 'America/Argentina/Buenos_Aires';
const MAX_DIAS = 366 * 3;
const DIAS_POR_DEFECTO = 30;

export type Agrupacion = 'dia' | 'semana' | 'mes';
const UNIDADES: Record<Agrupacion, string> = { dia: 'day', semana: 'week', mes: 'month' };

export interface Rango {
  desde: string; // YYYY-MM-DD, hora de Argentina
  hasta: string; // YYYY-MM-DD, hora de Argentina (inclusive)
}

// Las fechas se guardan en UTC. Se filtran por día calendario argentino:
// desde las 00:00 del "desde" hasta las 23:59 del "hasta".
const COND_VENTAS = `
  v.estado_compra = 'confirmada'
  AND v.fecha_compra >= (($1::date)::timestamp AT TIME ZONE '${ZONA}') AT TIME ZONE 'UTC'
  AND v.fecha_compra <  (($2::date + 1)::timestamp AT TIME ZONE '${ZONA}') AT TIME ZONE 'UTC'
`;
// Mismo criterio de día calendario argentino, para cualquier columna de fecha
function condFecha(columna: string): string {
  return `${columna} >= (($1::date)::timestamp AT TIME ZONE '${ZONA}') AT TIME ZONE 'UTC'
  AND ${columna} <  (($2::date + 1)::timestamp AT TIME ZONE '${ZONA}') AT TIME ZONE 'UTC'`;
}
const FECHA_LOCAL = `((v.fecha_compra AT TIME ZONE 'UTC') AT TIME ZONE '${ZONA}')`;

function aNumero(valor: unknown): number {
  return Number(valor ?? 0);
}

function sumarDias(iso: string, dias: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

function fechaValida(iso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const d = new Date(`${iso}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso;
}

// Un carrito cuenta como "abandonado" en el período si se registró un aviso de carrito abandonado.
// Se lo considera "recuperado" si después del aviso se confirmó una compra con ese mismo carrito.
const AVISOS = `(
  SELECT n.id_carrito, MIN(n.fecha_envio) AS fecha_aviso, bool_or(n.estado_entrega = 'enviado') AS enviado
    FROM notificacion n
   WHERE n.tipo = 'carrito_abandonado' AND n.id_carrito IS NOT NULL
     AND ${condFecha('n.fecha_envio')}
   GROUP BY n.id_carrito
)`;
const RECUPERACION = `(
  SELECT v.id_venta, v.fecha_compra, v.precio_total + COALESCE(v.costo_envio, 0) AS monto
    FROM venta v
   WHERE v.id_carrito = av.id_carrito AND v.estado_compra = 'confirmada' AND v.fecha_compra >= av.fecha_aviso
   ORDER BY v.fecha_compra
   LIMIT 1
)`;

@Injectable()
export class EstadisticasService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly configuracionService: ConfiguracionService,
  ) {}

  // Período inmediatamente anterior y de la misma duración (para "comparar con el período anterior")
  periodoAnterior(rango: Rango): Rango {
    const dias = (Date.parse(`${rango.hasta}T00:00:00Z`) - Date.parse(`${rango.desde}T00:00:00Z`)) / 86_400_000 + 1;
    return { desde: sumarDias(rango.desde, -dias), hasta: sumarDias(rango.desde, -1) };
  }

  // Hoy en Argentina, sin depender de la zona horaria del servidor
  private hoy(): string {
    return new Intl.DateTimeFormat('en-CA', { timeZone: ZONA }).format(new Date());
  }

  resolverRango(desde?: string, hasta?: string): Rango {
    const fin = hasta || this.hoy();
    const inicio = desde || sumarDias(fin, -(DIAS_POR_DEFECTO - 1));

    if (!fechaValida(inicio) || !fechaValida(fin)) {
      throw new BadRequestException('Las fechas deben tener el formato AAAA-MM-DD');
    }
    if (inicio > fin) {
      throw new BadRequestException('La fecha "desde" no puede ser posterior a "hasta"');
    }
    const dias = (Date.parse(`${fin}T00:00:00Z`) - Date.parse(`${inicio}T00:00:00Z`)) / 86_400_000 + 1;
    if (dias > MAX_DIAS) {
      throw new BadRequestException('El período no puede superar los 3 años');
    }
    return { desde: inicio, hasta: fin };
  }

  resolverAgrupacion(valor?: string): Agrupacion {
    if (!valor) return 'dia';
    if (valor === 'dia' || valor === 'semana' || valor === 'mes') return valor;
    throw new BadRequestException('Agrupación inválida (dia, semana o mes)');
  }

  async ventas(rango: Rango, agrupar: Agrupacion) {
    const unidad = UNIDADES[agrupar];
    const params = [rango.desde, rango.hasta];

    const [resumen] = await this.dataSource.query(
      `SELECT COUNT(*) AS cantidad,
              COALESCE(SUM(v.precio_total), 0) AS monto_productos,
              COALESCE(SUM(COALESCE(v.costo_envio, 0)), 0) AS monto_envio
         FROM venta v
        WHERE ${COND_VENTAS}`,
      params,
    );

    // generate_series completa con ceros los períodos sin ventas, para que el gráfico no tenga huecos
    const serie = await this.dataSource.query(
      `WITH ventas AS (
         SELECT date_trunc('${unidad}', ${FECHA_LOCAL})::date AS periodo,
                COUNT(*) AS cantidad,
                SUM(v.precio_total) AS monto_productos,
                SUM(COALESCE(v.costo_envio, 0)) AS monto_envio
           FROM venta v
          WHERE ${COND_VENTAS}
          GROUP BY 1
       ),
       periodos AS (
         SELECT generate_series(date_trunc('${unidad}', $1::timestamp)::date, $2::date, interval '1 ${unidad}')::date AS periodo
       )
       SELECT to_char(p.periodo, 'YYYY-MM-DD') AS periodo,
              COALESCE(v.cantidad, 0) AS cantidad,
              COALESCE(v.monto_productos, 0) AS monto_productos,
              COALESCE(v.monto_envio, 0) AS monto_envio
         FROM periodos p
         LEFT JOIN ventas v ON v.periodo = p.periodo
        ORDER BY p.periodo`,
      params,
    );

    const cantidad = aNumero(resumen.cantidad);
    const productos = aNumero(resumen.monto_productos);
    const envio = aNumero(resumen.monto_envio);

    return {
      rango,
      agrupar,
      resumen: {
        cantidad,
        monto_productos: productos,
        monto_envio: envio,
        monto_total: productos + envio,
        ticket_promedio: cantidad > 0 ? Math.round(((productos + envio) / cantidad) * 100) / 100 : 0,
      },
      serie: serie.map((f: Record<string, unknown>) => ({
        periodo: f.periodo as string,
        cantidad: aNumero(f.cantidad),
        monto: aNumero(f.monto_productos) + aNumero(f.monto_envio),
      })),
    };
  }

  async productos(rango: Rango) {
    const params = [rango.desde, rango.hasta];

    // Los montos son a precio de lista (antes del descuento VIP)
    const masVendidos = await this.dataSource.query(
      `SELECT p.id_producto, p.nombre,
              SUM(d.cantidad) AS unidades,
              SUM(d.cantidad * d.precio_unitario) AS monto
         FROM venta v
         JOIN detalle_venta d ON d.id_venta = v.id_venta
         JOIN variante va ON va.id_variante = d.id_variante
         JOIN producto p ON p.id_producto = va.id_producto
        WHERE ${COND_VENTAS}
        GROUP BY p.id_producto, p.nombre
        ORDER BY unidades DESC, monto DESC, p.nombre
        LIMIT 10`,
      params,
    );

    const porCategoria = await this.dataSource.query(
      `SELECT c.nombre AS categoria,
              SUM(d.cantidad) AS unidades,
              SUM(d.cantidad * d.precio_unitario) AS monto
         FROM venta v
         JOIN detalle_venta d ON d.id_venta = v.id_venta
         JOIN variante va ON va.id_variante = d.id_variante
         JOIN producto p ON p.id_producto = va.id_producto
         JOIN subcategoria s ON s.id_subcategoria = p.id_subcategoria
         JOIN categoria c ON c.id_categoria = s.id_categoria
        WHERE ${COND_VENTAS}
        GROUP BY c.nombre
        ORDER BY monto DESC, c.nombre`,
      params,
    );

    return {
      rango,
      mas_vendidos: masVendidos.map((f: Record<string, unknown>) => ({
        id_producto: aNumero(f.id_producto),
        nombre: f.nombre as string,
        unidades: aNumero(f.unidades),
        monto: aNumero(f.monto),
      })),
      por_categoria: porCategoria.map((f: Record<string, unknown>) => ({
        categoria: f.categoria as string,
        unidades: aNumero(f.unidades),
        monto: aNumero(f.monto),
      })),
    };
  }

  // Solo pedidos con módulo de envíos (las ventas viejas no tienen tipo de entrega)
  async envios(rango: Rango) {
    const params = [rango.desde, rango.hasta];
    const base = `${COND_VENTAS} AND v.tipo_entrega IS NOT NULL`;

    const porTipo = await this.dataSource.query(
      `SELECT v.tipo_entrega AS tipo, COUNT(*) AS cantidad,
              SUM(COALESCE(v.costo_envio, 0)) AS monto_envio,
              COUNT(*) FILTER (WHERE v.tipo_entrega = 'domicilio' AND COALESCE(v.costo_envio, 0) = 0) AS gratis
         FROM venta v
        WHERE ${base}
        GROUP BY v.tipo_entrega
        ORDER BY cantidad DESC`,
      params,
    );

    const porProvincia = await this.dataSource.query(
      `SELECT v.envio_provincia AS provincia, COUNT(*) AS cantidad,
              SUM(v.precio_total + COALESCE(v.costo_envio, 0)) AS monto
         FROM venta v
        WHERE ${base} AND v.tipo_entrega = 'domicilio'
        GROUP BY v.envio_provincia
        ORDER BY cantidad DESC, monto DESC, provincia`,
      params,
    );

    const porEstado = await this.dataSource.query(
      `SELECT v.estado_envio AS estado, COUNT(*) AS cantidad
         FROM venta v
        WHERE ${base}
        GROUP BY v.estado_envio
        ORDER BY cantidad DESC`,
      params,
    );

    const [tiempos] = await this.dataSource.query(
      `SELECT AVG(EXTRACT(EPOCH FROM (v.fecha_despacho - v.fecha_compra)) / 3600.0) AS horas_hasta_despacho,
              AVG(EXTRACT(EPOCH FROM (v.fecha_entrega - v.fecha_compra)) / 86400.0) AS dias_hasta_entrega
         FROM venta v
        WHERE ${base}`,
      params,
    );

    const redondear = (valor: unknown) =>
      valor === null || valor === undefined ? null : Math.round(Number(valor) * 10) / 10;

    return {
      rango,
      por_tipo: porTipo.map((f: Record<string, unknown>) => ({
        tipo: f.tipo as string,
        cantidad: aNumero(f.cantidad),
        monto_envio: aNumero(f.monto_envio),
        con_envio_gratis: aNumero(f.gratis),
      })),
      por_provincia: porProvincia.map((f: Record<string, unknown>) => ({
        provincia: f.provincia as string,
        cantidad: aNumero(f.cantidad),
        monto: aNumero(f.monto),
      })),
      por_estado: porEstado.map((f: Record<string, unknown>) => ({
        estado: f.estado as string,
        cantidad: aNumero(f.cantidad),
      })),
      horas_hasta_despacho: redondear(tiempos?.horas_hasta_despacho),
      dias_hasta_entrega: redondear(tiempos?.dias_hasta_entrega),
    };
  }

  // ───────────────────────── Paneles del módulo de Estadísticas ─────────────────────────

  // 1) Ventas: ingresos (pago aprobado), operaciones por estado y comparación con el período anterior
  async panelVentas(rango: Rango) {
    const anterior = this.periodoAnterior(rango);
    const actual = await this.ventas(rango, 'dia');
    const previo = await this.ventas(anterior, 'dia');
    const estadosActual = await this.operacionesPorEstado(rango);
    const estadosPrevio = await this.operacionesPorEstado(anterior);

    const pendientes = (e: { estado: string; cantidad: number }[]) =>
      e.find((x) => x.estado === 'pendiente')?.cantidad ?? 0;

    return {
      rango,
      anterior,
      actual: { ...actual.resumen, pendientes: pendientes(estadosActual) },
      previo: { ...previo.resumen, pendientes: pendientes(estadosPrevio) },
      serie_actual: actual.serie,
      serie_anterior: previo.serie,
      estados: estadosActual,
    };
  }

  private async operacionesPorEstado(rango: Rango) {
    const filas = await this.dataSource.query(
      `SELECT v.estado_compra AS estado, COUNT(*) AS cantidad,
              COALESCE(SUM(v.precio_total + COALESCE(v.costo_envio, 0)), 0) AS importe
         FROM venta v
        WHERE ${condFecha('v.fecha_compra')}
        GROUP BY v.estado_compra`,
      [rango.desde, rango.hasta],
    );
    // Siempre devuelve los tres estados, en el mismo orden, aunque alguno no tenga operaciones
    return (['confirmada', 'pendiente', 'cancelada'] as const).map((estado) => {
      const f = filas.find((x: Record<string, unknown>) => x.estado === estado);
      return { estado, cantidad: aNumero(f?.cantidad), importe: aNumero(f?.importe) };
    });
  }

  // 2) Productos e inventario: ranking de ventas del período + stock actual por variante
  async panelProductos(rango: Rango) {
    const params = [rango.desde, rango.hasta];
    const umbral = await this.configuracionService.obtenerNumero('stock_minimo', 3);

    const [resumen] = await this.dataSource.query(
      `SELECT COALESCE(SUM(d.cantidad), 0) AS unidades, COUNT(DISTINCT va.id_producto) AS productos
         FROM venta v
         JOIN detalle_venta d ON d.id_venta = v.id_venta
         JOIN variante va ON va.id_variante = d.id_variante
        WHERE ${COND_VENTAS}`,
      params,
    );

    const masVendidos = await this.dataSource.query(
      `SELECT p.id_producto, p.nombre, SUM(d.cantidad) AS unidades
         FROM venta v
         JOIN detalle_venta d ON d.id_venta = v.id_venta
         JOIN variante va ON va.id_variante = d.id_variante
         JOIN producto p ON p.id_producto = va.id_producto
        WHERE ${COND_VENTAS}
        GROUP BY p.id_producto, p.nombre
        ORDER BY unidades DESC, p.nombre
        LIMIT 5`,
      params,
    );

    // Productos activos, incluso los que no vendieron nada (son justamente los "menos vendidos")
    const menosVendidos = await this.dataSource.query(
      `SELECT p.id_producto, p.nombre, COALESCE(SUM(d.cantidad) FILTER (WHERE ${COND_VENTAS.replace(/\s+/g, ' ')}), 0) AS unidades
         FROM producto p
         JOIN variante va ON va.id_producto = p.id_producto
         LEFT JOIN detalle_venta d ON d.id_variante = va.id_variante
         LEFT JOIN venta v ON v.id_venta = d.id_venta
        WHERE p.estado = 'activa' AND va.estado = 'activa'
        GROUP BY p.id_producto, p.nombre
        ORDER BY unidades ASC, p.nombre
        LIMIT 5`,
      params,
    );

    const variantes = await this.dataSource.query(
      `SELECT va.id_variante, p.nombre AS producto, va.stock_disponible,
              (SELECT c.valor FROM variante_caracteristica vc
                 JOIN caracteristica c ON c.id_caracteristica = vc.id_caracteristica
                 JOIN opcion o ON o.id_opcion = c.id_opcion
                WHERE vc.id_variante = va.id_variante AND lower(o.nombre) = 'material' LIMIT 1) AS material,
              (SELECT string_agg(c.valor, ' · ' ORDER BY c.id_caracteristica)
                 FROM variante_caracteristica vc
                 JOIN caracteristica c ON c.id_caracteristica = vc.id_caracteristica
                 JOIN opcion o ON o.id_opcion = c.id_opcion
                WHERE vc.id_variante = va.id_variante AND lower(o.nombre) <> 'material') AS medida
         FROM variante va
         JOIN producto p ON p.id_producto = va.id_producto
        WHERE va.estado = 'activa' AND p.estado = 'activa'
        ORDER BY va.stock_disponible ASC, p.nombre ASC, va.id_variante
        LIMIT 500`,
    );

    const items = variantes.map((f: Record<string, unknown>) => {
      const stock = aNumero(f.stock_disponible);
      return {
        id_variante: aNumero(f.id_variante),
        producto: f.producto as string,
        material: (f.material as string | null) ?? '—',
        medida: (f.medida as string | null) ?? '—',
        stock,
        estado: stock <= 0 ? 'sin_stock' : stock <= umbral ? 'stock_bajo' : 'ok',
      };
    });

    const mapearRanking = (f: Record<string, unknown>) => ({
      id_producto: aNumero(f.id_producto),
      nombre: f.nombre as string,
      unidades: aNumero(f.unidades),
    });

    return {
      rango,
      umbral,
      unidades_vendidas: aNumero(resumen.unidades),
      productos_con_ventas: aNumero(resumen.productos),
      variantes_stock_bajo: items.filter((i: { estado: string }) => i.estado === 'stock_bajo').length,
      variantes_sin_stock: items.filter((i: { estado: string }) => i.estado === 'sin_stock').length,
      mas_vendidos: masVendidos.map(mapearRanking),
      menos_vendidos: menosVendidos.map(mapearRanking),
      variantes: items,
    };
  }

  // 3) Clientes: compradores, recurrentes y niveles del Club VIP
  async panelClientes(rango: Rango) {
    const anterior = this.periodoAnterior(rango);
    const actual = await this.compradores(rango);
    const previo = await this.compradores(anterior);

    const [totales] = await this.dataSource.query(
      `SELECT (SELECT COUNT(*) FROM usuario WHERE rol = 'cliente') AS registrados,
              (SELECT COUNT(*) FROM cliente_vip) AS vip`,
    );

    const niveles = await this.dataSource.query(
      `SELECT n.id_nivel_vip, n.nombre_nivel, n.monto_min_requerido, n.cantidad_compras_min_requerida,
              COUNT(cv.id_cliente_vip) AS clientes
         FROM nivel_vip n
         LEFT JOIN cliente_vip cv ON cv.id_nivel_vip = n.id_nivel_vip
        GROUP BY n.id_nivel_vip, n.nombre_nivel, n.monto_min_requerido, n.cantidad_compras_min_requerida
        ORDER BY n.monto_min_requerido, n.id_nivel_vip`,
    );

    const top = await this.dataSource.query(
      `SELECT u.id_usuario, u.nombre, u.apellido,
              COUNT(*) AS compras, SUM(v.precio_total + COALESCE(v.costo_envio, 0)) AS importe,
              n.nombre_nivel, n.monto_min_requerido AS nivel_monto_min,
              (SELECT COUNT(*) FROM venta h WHERE h.id_usuario = u.id_usuario AND h.estado_compra = 'confirmada') AS compras_historicas,
              (SELECT COALESCE(SUM(h.precio_total), 0) FROM venta h WHERE h.id_usuario = u.id_usuario AND h.estado_compra = 'confirmada') AS monto_historico
         FROM venta v
         JOIN usuario u ON u.id_usuario = v.id_usuario
         LEFT JOIN cliente_vip cv ON cv.id_usuario = u.id_usuario
         LEFT JOIN nivel_vip n ON n.id_nivel_vip = cv.id_nivel_vip
        WHERE ${COND_VENTAS}
        GROUP BY u.id_usuario, u.nombre, u.apellido, n.nombre_nivel, n.monto_min_requerido
        ORDER BY compras DESC, importe DESC, u.apellido, u.nombre
        LIMIT 10`,
      [rango.desde, rango.hasta],
    );

    const listaNiveles = niveles.map((n: Record<string, unknown>) => ({
      nivel: n.nombre_nivel as string,
      clientes: aNumero(n.clientes),
      monto_min: aNumero(n.monto_min_requerido),
      compras_min: aNumero(n.cantidad_compras_min_requerida),
    }));

    return {
      rango,
      anterior,
      registrados: aNumero(totales.registrados),
      cumplen_vip: aNumero(totales.vip),
      compraron: actual.compraron,
      recurrentes: actual.recurrentes,
      compraron_anterior: previo.compraron,
      recurrentes_anterior: previo.recurrentes,
      frecuencia: actual.frecuencia,
      por_nivel: listaNiveles,
      top_clientes: top.map((f: Record<string, unknown>) => {
        const montoMin = f.nivel_monto_min === null || f.nivel_monto_min === undefined ? null : aNumero(f.nivel_monto_min);
        // Próximo nivel: el primero que exige más monto que el actual (o el primero si todavía no tiene nivel)
        const proximo = listaNiveles.find((n: { monto_min: number }) => montoMin === null || n.monto_min > montoMin);
        return {
          id_usuario: aNumero(f.id_usuario),
          nombre: `${f.nombre} ${f.apellido}`,
          nivel: (f.nombre_nivel as string | null) ?? 'Sin nivel',
          compras: aNumero(f.compras),
          importe: aNumero(f.importe),
          proximo_nivel: proximo?.nivel ?? null,
          faltan_compras: proximo ? Math.max(0, proximo.compras_min - aNumero(f.compras_historicas)) : 0,
          faltan_monto: proximo ? Math.max(0, proximo.monto_min - aNumero(f.monto_historico)) : 0,
        };
      }),
    };
  }

  private async compradores(rango: Rango) {
    const filas = await this.dataSource.query(
      `SELECT c.compras, COUNT(*) AS clientes
         FROM (SELECT v.id_usuario, COUNT(*) AS compras
                 FROM venta v
                WHERE ${COND_VENTAS}
                GROUP BY v.id_usuario) c
        GROUP BY c.compras`,
      [rango.desde, rango.hasta],
    );
    let compraron = 0;
    let recurrentes = 0;
    let una = 0;
    let dos = 0;
    let tresOMas = 0;
    for (const f of filas as Record<string, unknown>[]) {
      const compras = aNumero(f.compras);
      const clientes = aNumero(f.clientes);
      compraron += clientes;
      if (compras === 1) una += clientes;
      else if (compras === 2) dos += clientes;
      else tresOMas += clientes;
      if (compras >= 2) recurrentes += clientes;
    }
    return {
      compraron,
      recurrentes,
      frecuencia: [
        { etiqueta: '1 compra', clientes: una },
        { etiqueta: '2 compras', clientes: dos },
        { etiqueta: '3 o más compras', clientes: tresOMas },
      ],
    };
  }

  // 4) Rescate de ventas: carritos abandonados → avisados → recuperados
  // Tasa de recuperación = carritos recuperados ÷ carritos abandonados × 100
  async panelRescate(rango: Rango) {
    const anterior = this.periodoAnterior(rango);
    const actual = await this.resumenRescate(rango);
    const previo = await this.resumenRescate(anterior);

    const ventas = await this.dataSource.query(
      `WITH av AS ${AVISOS}
       SELECT u.nombre, u.apellido, av.fecha_aviso, rec.fecha_compra, rec.monto
         FROM av
         JOIN carrito c ON c.id_carrito = av.id_carrito
         JOIN usuario u ON u.id_usuario = c.id_usuario
         JOIN LATERAL ${RECUPERACION} rec ON true
        WHERE av.enviado
        ORDER BY rec.fecha_compra DESC
        LIMIT 20`,
      [rango.desde, rango.hasta],
    );

    return {
      rango,
      anterior,
      actual,
      previo,
      ventas_recuperadas: ventas.map((f: Record<string, unknown>) => ({
        cliente: `${f.nombre} ${f.apellido}`,
        fecha_aviso: new Date(f.fecha_aviso as string).toISOString(),
        fecha_compra: new Date(f.fecha_compra as string).toISOString(),
        monto: aNumero(f.monto),
      })),
    };
  }

  private async resumenRescate(rango: Rango) {
    const [f] = await this.dataSource.query(
      `WITH av AS ${AVISOS}
       SELECT COUNT(*) AS abandonados,
              COUNT(*) FILTER (WHERE av.enviado) AS notificados,
              COUNT(rec.id_venta) AS recuperados,
              COALESCE(SUM(rec.monto), 0) AS monto
         FROM av
         LEFT JOIN LATERAL ${RECUPERACION} rec ON av.enviado`,
      [rango.desde, rango.hasta],
    );
    const abandonados = aNumero(f.abandonados);
    const recuperados = aNumero(f.recuperados);
    return {
      abandonados,
      notificados: aNumero(f.notificados),
      recuperados,
      monto_recuperado: aNumero(f.monto),
      tasa_recuperacion: abandonados > 0 ? Math.round((recuperados / abandonados) * 1000) / 10 : 0,
    };
  }
}
