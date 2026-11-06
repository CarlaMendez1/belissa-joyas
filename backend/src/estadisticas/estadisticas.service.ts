import { Injectable, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';

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

@Injectable()
export class EstadisticasService {
  constructor(private readonly dataSource: DataSource) {}

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
}
