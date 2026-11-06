import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

const ZONA = 'America/Argentina/Buenos_Aires';
// Una variante cuenta como "stock crítico" con esta cantidad o menos
export const STOCK_MINIMO = 3;
const CANTIDAD_LISTAS = 5;

// Las fechas se guardan en UTC; el "mes" se mide en hora de Argentina
const LOCAL = (columna: string) => `((${columna} AT TIME ZONE 'UTC') AT TIME ZONE '${ZONA}')`;
const INICIO_MES = `date_trunc('month', now() AT TIME ZONE '${ZONA}')`;

const aNumero = (valor: unknown) => Number(valor ?? 0);

type Fila = Record<string, unknown>;

@Injectable()
export class DashboardService {
  constructor(private readonly dataSource: DataSource) {}

    async obtenerResumen() {
    const [ventas, usuarios, vip, stock, porDespachar, ultimasVentas, carritos, serie, categorias] = await Promise.all([
      this.ventasDelMes(),
      this.usuariosActivos(),
      this.clientesVip(),
      this.stockCritico(),
      this.pedidosPorDespachar(),
      this.ultimasVentas(),
      this.carritosAbandonados(),
      this.ventasPorDia(),
      this.ingresosPorCategoria(),
    ]);
    const entregados = await this.pedidosEntregadosDelMes();
    const conversion = await this.tasaDeConversion(ventas.cantidad);

    return {
      ventas_mes: ventas,
      usuarios_activos: usuarios,
      clientes_vip: vip,
      stock_critico: stock,
      pedidos_por_despachar: porDespachar,
      ultimas_ventas: ultimasVentas,
      carritos_abandonados: carritos,
      pedidos_entregados_mes: entregados,
      tasa_conversion: conversion,
      ventas_30_dias: serie,
      ingresos_por_categoria: categorias,
    };
  }

  private async pedidosEntregadosDelMes() {
    const [f] = await this.dataSource.query(
      `SELECT COUNT(*) AS total
         FROM venta v
        WHERE v.estado_compra = 'confirmada' AND v.estado_envio = 'entregado'
          AND ${LOCAL('v.fecha_entrega')} >= ${INICIO_MES}`,
    );
    return aNumero(f.total);
  }

  // Compras confirmadas del mes sobre carritos con productos que tuvieron actividad en el mes.
  // Un carrito que termina en compra también tiene actividad, así que el cociente no pasa de 100%.
  private async tasaDeConversion(ventasDelMes: number) {
    const [f] = await this.dataSource.query(
      `SELECT COUNT(*) AS total
         FROM carrito c
        WHERE ${LOCAL('c.fecha_ultima_act')} >= ${INICIO_MES}
          AND EXISTS (SELECT 1 FROM item_carrito i WHERE i.id_carrito = c.id_carrito)`,
    );
    const carritos = aNumero(f.total);
    return {
      carritos,
      porcentaje: carritos > 0 ? Math.min(100, Math.round((ventasDelMes / carritos) * 1000) / 10) : null,
    };
  }

  // Ventas confirmadas (productos + envío) de los últimos 30 días, día por día; los días sin ventas valen 0
  private async ventasPorDia() {
    const filas: Fila[] = await this.dataSource.query(
      `WITH dias AS (
         SELECT generate_series(
                  (now() AT TIME ZONE '${ZONA}')::date - 29,
                  (now() AT TIME ZONE '${ZONA}')::date,
                  interval '1 day')::date AS dia
       ),
       ventas AS (
         SELECT ${LOCAL('v.fecha_compra')}::date AS dia,
                SUM(v.precio_total + COALESCE(v.costo_envio, 0)) AS monto
           FROM venta v
          WHERE v.estado_compra = 'confirmada'
            AND ${LOCAL('v.fecha_compra')}::date >= (now() AT TIME ZONE '${ZONA}')::date - 29
          GROUP BY 1
       )
       SELECT to_char(d.dia, 'YYYY-MM-DD') AS dia, COALESCE(v.monto, 0) AS monto
         FROM dias d
         LEFT JOIN ventas v ON v.dia = d.dia
        ORDER BY d.dia`,
    );
    return filas.map((f) => ({ dia: f.dia as string, monto: aNumero(f.monto) }));
  }

  // Mismos 30 días; montos a precio de lista (antes del descuento VIP)
  private async ingresosPorCategoria() {
    const filas: Fila[] = await this.dataSource.query(
      `SELECT c.nombre AS categoria, SUM(d.cantidad * d.precio_unitario) AS monto
         FROM venta v
         JOIN detalle_venta d ON d.id_venta = v.id_venta
         JOIN variante va ON va.id_variante = d.id_variante
         JOIN producto p ON p.id_producto = va.id_producto
         JOIN subcategoria s ON s.id_subcategoria = p.id_subcategoria
         JOIN categoria c ON c.id_categoria = s.id_categoria
        WHERE v.estado_compra = 'confirmada'
          AND ${LOCAL('v.fecha_compra')}::date >= (now() AT TIME ZONE '${ZONA}')::date - 29
        GROUP BY c.nombre
        ORDER BY monto DESC, c.nombre`,
    );
    return filas.map((f) => ({ categoria: f.categoria as string, monto: aNumero(f.monto) }));
  }

  // Devuelve el resumen del dashboard
  private async resumen() {
    const [ventas, usuarios, vip, stock, porDespachar, ultimasVentas, carritos] = await Promise.all([
      this.ventasDelMes(),
      this.usuariosActivos(),
      this.clientesVip(),
      this.stockCritico(),
      this.pedidosPorDespachar(),
      this.ultimasVentas(),
      this.carritosAbandonados(),
    ]);
    return {
      ventas_mes: ventas,
      usuarios_activos: usuarios,
      clientes_vip: vip,
      stock_critico: stock,
      pedidos_por_despachar: porDespachar,
      ultimas_ventas: ultimasVentas,
      carritos_abandonados: carritos,
    };
  }

  // Ventas confirmadas del mes en curso (productos + envío) y comparación contra el mismo
  // tramo del mes anterior (mismos días transcurridos), para que la variación sea justa.
  private async ventasDelMes() {
    const [f] = await this.dataSource.query(
      `WITH lim AS (
         SELECT ${INICIO_MES} AS ini,
                (now() AT TIME ZONE '${ZONA}') AS fin
       ),
       lim2 AS (
         SELECT ini, fin,
                ini - interval '1 month' AS ini_prev,
                LEAST((ini - interval '1 month') + (fin - ini), ini) AS fin_prev
           FROM lim
       )
       SELECT COUNT(*) FILTER (WHERE x.f >= l.ini) AS cantidad,
              COALESCE(SUM(v.precio_total + COALESCE(v.costo_envio, 0)) FILTER (WHERE x.f >= l.ini), 0) AS monto,
              COALESCE(SUM(v.precio_total + COALESCE(v.costo_envio, 0))
                FILTER (WHERE x.f >= l.ini_prev AND x.f < l.fin_prev), 0) AS monto_anterior
         FROM venta v
         CROSS JOIN lim2 l
         CROSS JOIN LATERAL (SELECT ${LOCAL('v.fecha_compra')} AS f) x
        WHERE v.estado_compra = 'confirmada' AND x.f >= l.ini_prev`,
    );
    const monto = aNumero(f.monto);
    const anterior = aNumero(f.monto_anterior);
    return {
      cantidad: aNumero(f.cantidad),
      monto,
      monto_anterior: anterior,
      // null cuando no hay mes anterior con qué comparar
      variacion_porcentaje: anterior > 0 ? Math.round(((monto - anterior) / anterior) * 100) : null,
    };
  }

  private async usuariosActivos() {
    const [f] = await this.dataSource.query(
      `SELECT COUNT(*) FILTER (WHERE estado = 'activo') AS total,
              COUNT(*) FILTER (WHERE estado = 'activo' AND ${LOCAL('fecha_registro')} >= ${INICIO_MES}) AS nuevos_mes
         FROM usuario`,
    );
    return { total: aNumero(f.total), nuevos_mes: aNumero(f.nuevos_mes) };
  }

  private async clientesVip() {
    const [f] = await this.dataSource.query(
      `SELECT COUNT(*) AS total,
              COUNT(*) FILTER (WHERE cv.fecha_categorizacion >= (${INICIO_MES})::date) AS nuevos_mes
         FROM cliente_vip cv
         JOIN usuario u ON u.id_usuario = cv.id_usuario
        WHERE u.estado = 'activo'`,
    );
    return { total: aNumero(f.total), nuevos_mes: aNumero(f.nuevos_mes) };
  }

  private async stockCritico() {
    const [resumen] = await this.dataSource.query(
      `SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE va.stock_disponible <= 0) AS sin_stock
         FROM variante va
         JOIN producto p ON p.id_producto = va.id_producto
        WHERE va.estado = 'activa' AND p.estado = 'activa' AND va.stock_disponible <= $1`,
      [STOCK_MINIMO],
    );
    const filas: Fila[] = await this.dataSource.query(
      `SELECT va.id_variante, p.id_producto, p.nombre, va.stock_disponible,
              COALESCE((SELECT string_agg(c.valor, ' · ' ORDER BY c.id_caracteristica)
                          FROM variante_caracteristica vc
                          JOIN caracteristica c ON c.id_caracteristica = vc.id_caracteristica
                         WHERE vc.id_variante = va.id_variante), va.codigo_sku) AS detalle
         FROM variante va
         JOIN producto p ON p.id_producto = va.id_producto
        WHERE va.estado = 'activa' AND p.estado = 'activa' AND va.stock_disponible <= $1
        ORDER BY va.stock_disponible ASC, p.nombre ASC
        LIMIT ${CANTIDAD_LISTAS}`,
      [STOCK_MINIMO],
    );
    return {
      umbral: STOCK_MINIMO,
      total: aNumero(resumen.total),
      sin_stock: aNumero(resumen.sin_stock),
      items: filas.map((f) => ({
        id_variante: aNumero(f.id_variante),
        id_producto: aNumero(f.id_producto),
        nombre: f.nombre as string,
        detalle: f.detalle as string,
        stock: aNumero(f.stock_disponible),
      })),
    };
  }

  // Pagados que esperan despacho (domicilio) o retiro del cliente (retiro en local)
  private async pedidosPorDespachar() {
    const filas: Fila[] = await this.dataSource.query(
      `SELECT v.id_venta, u.nombre, u.apellido, v.tipo_entrega, v.envio_provincia, v.estado_envio,
              v.fecha_compra, COUNT(*) OVER () AS total
         FROM venta v
         JOIN usuario u ON u.id_usuario = v.id_usuario
        WHERE v.estado_compra = 'confirmada'
          AND v.estado_envio IN ('pendiente_despacho', 'retiro_listo')
        ORDER BY v.fecha_compra DESC
        LIMIT ${CANTIDAD_LISTAS}`,
    );
    return {
      total: filas.length > 0 ? aNumero(filas[0].total) : 0,
      items: filas.map((f) => ({
        id_venta: aNumero(f.id_venta),
        cliente: `${f.nombre} ${f.apellido}`.trim(),
        tipo_entrega: f.tipo_entrega as string,
        provincia: (f.envio_provincia as string | null) ?? null,
        estado_envio: f.estado_envio as string,
        fecha: f.fecha_compra as Date,
      })),
    };
  }

  private async ultimasVentas() {
    const filas: Fila[] = await this.dataSource.query(
      `SELECT v.id_venta, u.nombre, u.apellido, v.fecha_compra,
              v.precio_total + COALESCE(v.costo_envio, 0) AS monto,
              (SELECT p.nombre
                 FROM detalle_venta d
                 JOIN variante va ON va.id_variante = d.id_variante
                 JOIN producto p ON p.id_producto = va.id_producto
                WHERE d.id_venta = v.id_venta
                ORDER BY d.cantidad * d.precio_unitario DESC, p.nombre
                LIMIT 1) AS producto,
              (SELECT COUNT(DISTINCT va.id_producto)
                 FROM detalle_venta d
                 JOIN variante va ON va.id_variante = d.id_variante
                WHERE d.id_venta = v.id_venta) AS productos
         FROM venta v
         JOIN usuario u ON u.id_usuario = v.id_usuario
        WHERE v.estado_compra = 'confirmada'
        ORDER BY v.fecha_compra DESC
        LIMIT ${CANTIDAD_LISTAS}`,
    );
    return filas.map((f) => ({
      id_venta: aNumero(f.id_venta),
      cliente: `${f.nombre} ${f.apellido}`.trim(),
      producto: (f.producto as string | null) ?? null,
      otros_productos: Math.max(0, aNumero(f.productos) - 1),
      monto: aNumero(f.monto),
      fecha: f.fecha_compra as Date,
    }));
  }

  private async carritosAbandonados() {
        const [conteo] = await this.dataSource.query(
      `SELECT COUNT(*) AS total
         FROM carrito c
        WHERE c.estado = 'abandonado'
          AND EXISTS (SELECT 1 FROM item_carrito i WHERE i.id_carrito = c.id_carrito)`,
    );
    const filas: Fila[] = await this.dataSource.query(
      `SELECT c.id_carrito, u.nombre, u.apellido, c.fecha_ultima_act,
              (SELECT COALESCE(SUM(i.cantidad), 0) FROM item_carrito i WHERE i.id_carrito = c.id_carrito) AS productos,
              (SELECT COALESCE(SUM(i.cantidad * i.precio_unitario), 0) FROM item_carrito i WHERE i.id_carrito = c.id_carrito) AS monto,
              EXISTS (SELECT 1 FROM notificacion n
                       WHERE n.id_carrito = c.id_carrito
                         AND n.tipo = 'carrito_abandonado'
                         AND n.estado_entrega = 'enviado') AS mail_enviado
         FROM carrito c
         JOIN usuario u ON u.id_usuario = c.id_usuario
        WHERE c.estado = 'abandonado'
          AND EXISTS (SELECT 1 FROM item_carrito i WHERE i.id_carrito = c.id_carrito)
        ORDER BY c.fecha_ultima_act DESC
        LIMIT 3`,
    );
       return {
      total: aNumero(conteo.total),
      items: filas.map((f) => ({
        id_carrito: aNumero(f.id_carrito),
        cliente: `${f.nombre} ${f.apellido}`.trim(),
        productos: aNumero(f.productos),
        monto: aNumero(f.monto),
        mail_enviado: Boolean(f.mail_enviado),
        fecha: f.fecha_ultima_act as Date,
      })),
    };
 }
}
