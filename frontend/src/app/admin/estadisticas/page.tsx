'use client';
import { useEffect, useState, type ReactNode } from 'react';
import { useSession } from 'next-auth/react';
import { FileDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GraficoLinea, GraficoBarras } from '@/components/graficos';
import { exportarPDF, type SpecPDF } from '@/lib/estadisticas-pdf';
import {
  getEstadisticas,
  type PanelEstadisticas,
  type SeccionEstadisticas,
  type PanelVentas,
  type PanelProductos,
  type PanelClientes,
  type PanelRescate,
  type EstadisticasEnvios,
} from '@/lib/admin-api';

type Rango = { desde: string; hasta: string };

const SECCIONES: { valor: SeccionEstadisticas; titulo: string; descripcion: string; compara: boolean }[] = [
  { valor: 'ventas', titulo: 'Ventas', descripcion: 'Ingresos y operaciones del período', compara: true },
  { valor: 'productos', titulo: 'Productos e inventario', descripcion: 'Más y menos vendidos, stock por variante', compara: false },
  { valor: 'clientes', titulo: 'Clientes', descripcion: 'Compradores, recurrentes y Club VIP', compara: true },
  { valor: 'rescate', titulo: 'Rescate de ventas', descripcion: 'Carritos abandonados que se recuperaron', compara: true },
  { valor: 'envios', titulo: 'Envíos', descripcion: 'Pedidos por provincia y estado', compara: false },
];

// ───────── formatos ─────────
const dinero = (n: number) => `$${Math.round(n).toLocaleString('es-AR')}`;
const dineroCorto = (n: number) =>
  n >= 1_000_000
    ? `$${(n / 1_000_000).toLocaleString('es-AR', { maximumFractionDigits: 1 })} M`
    : n >= 1000
      ? `$${Math.round(n / 1000).toLocaleString('es-AR')} mil`
      : `$${Math.round(n)}`;
const entero = (n: number) => Math.round(n).toLocaleString('es-AR');
const porcentaje = (n: number) => `${n.toLocaleString('es-AR', { maximumFractionDigits: 1 })} %`;
const fechaAR = (iso: string) => iso.slice(0, 10).split('-').reverse().join('/');
const fechaHoraAR = (iso: string) =>
  new Date(iso).toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', dateStyle: 'short', timeStyle: 'short' });
const textoRango = (r: Rango) => `${fechaAR(r.desde)} al ${fechaAR(r.hasta)}`;

function aISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function rangoDesdeHoy(diasAtras: number): Rango {
  const desde = new Date();
  desde.setDate(desde.getDate() - diasAtras);
  return { desde: aISO(desde), hasta: aISO(new Date()) };
}

const PRESETS: { etiqueta: string; rango: () => Rango }[] = [
  { etiqueta: 'Últimos 7 días', rango: () => rangoDesdeHoy(6) },
  { etiqueta: 'Últimos 30 días', rango: () => rangoDesdeHoy(29) },
  {
    etiqueta: 'Este mes',
    rango: () => {
      const h = new Date();
      return { desde: aISO(new Date(h.getFullYear(), h.getMonth(), 1)), hasta: aISO(h) };
    },
  },
  {
    etiqueta: 'Mes pasado',
    rango: () => {
      const h = new Date();
      return { desde: aISO(new Date(h.getFullYear(), h.getMonth() - 1, 1)), hasta: aISO(new Date(h.getFullYear(), h.getMonth(), 0)) };
    },
  },
  {
    etiqueta: 'Este año',
    rango: () => {
      const h = new Date();
      return { desde: aISO(new Date(h.getFullYear(), 0, 1)), hasta: aISO(h) };
    },
  },
];

// Variación porcentual contra el período anterior (null si no hay base de comparación)
function variacion(actual: number, previo: number): number | null {
  if (previo === 0) return actual === 0 ? 0 : null;
  return ((actual - previo) / previo) * 100;
}
function textoVariacion(v: number | null): string {
  if (v === null) return 'sin base de comparación';
  if (v === 0) return '0 %';
  return `${v > 0 ? '▲' : '▼'} ${Math.abs(v).toLocaleString('es-AR', { maximumFractionDigits: 1 })} %`;
}

type Kpi = { titulo: string; valor: string; detalle?: string; variacion?: number | null };

// ───────── indicadores de cada apartado (los usan la pantalla y el PDF) ─────────
const kpisVentas = (d: PanelVentas, comparar: boolean): Kpi[] => [
  { titulo: 'Ingresos (pago aprobado)', valor: dinero(d.actual.monto_total), detalle: 'Productos + envío', variacion: comparar ? variacion(d.actual.monto_total, d.previo.monto_total) : undefined },
  { titulo: 'Ventas aprobadas', valor: entero(d.actual.cantidad), variacion: comparar ? variacion(d.actual.cantidad, d.previo.cantidad) : undefined },
  { titulo: 'Ticket promedio', valor: dinero(d.actual.ticket_promedio), variacion: comparar ? variacion(d.actual.ticket_promedio, d.previo.ticket_promedio) : undefined },
  { titulo: 'Pendientes de pago', valor: entero(d.actual.pendientes), variacion: comparar ? variacion(d.actual.pendientes, d.previo.pendientes) : undefined },
];
const kpisProductos = (d: PanelProductos): Kpi[] => [
  { titulo: 'Unidades vendidas', valor: entero(d.unidades_vendidas) },
  { titulo: 'Productos con ventas', valor: entero(d.productos_con_ventas) },
  { titulo: 'Variantes con stock bajo', valor: entero(d.variantes_stock_bajo), detalle: `${d.umbral} unidades o menos` },
  { titulo: 'Variantes sin stock', valor: entero(d.variantes_sin_stock) },
];
const kpisClientes = (d: PanelClientes, comparar: boolean): Kpi[] => [
  { titulo: 'Clientes registrados', valor: entero(d.registrados) },
  { titulo: 'Compraron en el período', valor: entero(d.compraron), variacion: comparar ? variacion(d.compraron, d.compraron_anterior) : undefined },
  { titulo: 'Compradores recurrentes', valor: entero(d.recurrentes), detalle: '2 o más compras', variacion: comparar ? variacion(d.recurrentes, d.recurrentes_anterior) : undefined },
  { titulo: 'Cumplen Club VIP', valor: entero(d.cumplen_vip) },
];
const kpisRescate = (d: PanelRescate, comparar: boolean): Kpi[] => [
  { titulo: 'Carritos abandonados', valor: entero(d.actual.abandonados), variacion: comparar ? variacion(d.actual.abandonados, d.previo.abandonados) : undefined },
  { titulo: 'Carritos recuperados', valor: entero(d.actual.recuperados), variacion: comparar ? variacion(d.actual.recuperados, d.previo.recuperados) : undefined },
  { titulo: 'Ventas recuperadas', valor: dinero(d.actual.monto_recuperado), variacion: comparar ? variacion(d.actual.monto_recuperado, d.previo.monto_recuperado) : undefined },
  { titulo: 'Tasa de recuperación', valor: porcentaje(d.actual.tasa_recuperacion), detalle: 'recuperados ÷ abandonados × 100', variacion: comparar ? variacion(d.actual.tasa_recuperacion, d.previo.tasa_recuperacion) : undefined },
];
const duracion = (horas: number | null, dias: number | null) => {
  if (horas !== null) return horas >= 48 ? `${(horas / 24).toLocaleString('es-AR', { maximumFractionDigits: 1 })} días` : `${horas.toLocaleString('es-AR', { maximumFractionDigits: 1 })} h`;
  if (dias !== null) return `${dias.toLocaleString('es-AR', { maximumFractionDigits: 1 })} días`;
  return 'Sin datos';
};
const kpisEnvios = (d: EstadisticasEnvios): Kpi[] => {
  const total = d.por_tipo.reduce((a, t) => a + t.cantidad, 0);
  const dom = d.por_tipo.find((t) => t.tipo === 'domicilio');
  const ret = d.por_tipo.find((t) => t.tipo === 'retiro');
  return [
    { titulo: 'Pedidos con entrega', valor: entero(total) },
    { titulo: 'Envío a domicilio', valor: entero(dom?.cantidad ?? 0), detalle: `Retiro en local: ${entero(ret?.cantidad ?? 0)}` },
    { titulo: 'Tiempo hasta el despacho', valor: duracion(d.horas_hasta_despacho, null), detalle: 'Promedio desde la compra' },
    { titulo: 'Tiempo hasta la entrega', valor: duracion(null, d.dias_hasta_entrega), detalle: 'Promedio desde la compra' },
  ];
};

const NOMBRE_ESTADO_COMPRA = { confirmada: 'Aprobadas', pendiente: 'Pendientes de pago', cancelada: 'Canceladas' } as const;
const NOMBRE_ESTADO_ENVIO: Record<string, string> = {
  pendiente_despacho: 'Pendientes de despacho',
  despachado: 'Despachados',
  retiro_listo: 'Listos para retirar',
  entregado: 'Entregados',
};
const NOMBRE_ESTADO_STOCK = { ok: 'Con stock', stock_bajo: 'Stock bajo', sin_stock: 'Sin stock' } as const;
const nombreTipo = (t: string) => (t === 'domicilio' ? 'Envío a domicilio' : t === 'retiro' ? 'Retiro en local' : t);

function condicionVip(c: PanelClientes['top_clientes'][number]) {
  if (!c.proximo_nivel) return 'Nivel máximo alcanzado';
  if (c.faltan_compras === 0 && c.faltan_monto === 0) return `Cumple las condiciones de ${c.proximo_nivel}`;
  return `Para ${c.proximo_nivel}: ${c.faltan_compras} compras y ${dinero(c.faltan_monto)}`;
}

// ───────── PDF: misma plantilla para todos los apartados ─────────
function especificacionPDF(seccion: SeccionEstadisticas, datos: PanelEstadisticas[SeccionEstadisticas], rango: Rango, comparar: boolean): SpecPDF {
  const meta = SECCIONES.find((s) => s.valor === seccion)!;
  const base = { titulo: meta.titulo, periodo: textoRango(rango) };
  const kpis = (k: Kpi[]) => k.map(({ titulo, valor }) => ({ titulo, valor }));

  if (seccion === 'ventas') {
    const d = datos as PanelVentas;
    const k = kpisVentas(d, comparar);
    const total = d.estados.reduce((a, e) => a + e.cantidad, 0);
    return {
      ...base,
      comparacion: comparar ? textoRango(d.anterior) : undefined,
      kpis: kpis(k),
      tablas: [
        ...(comparar ? [{ titulo: 'Comparación de períodos', cabeceras: ['Indicador', 'Actual', 'Anterior', 'Variación'], filas: filasComparacionVentas(d) }] : []),
        {
          titulo: 'Operaciones por estado',
          cabeceras: ['Estado', 'Cantidad', 'Importe', '% del total'],
          filas: d.estados.map((e) => [NOMBRE_ESTADO_COMPRA[e.estado], entero(e.cantidad), dinero(e.importe), total ? porcentaje((e.cantidad / total) * 100) : '0 %']),
        },
      ],
    };
  }
  if (seccion === 'productos') {
    const d = datos as PanelProductos;
    return {
      ...base,
      kpis: kpis(kpisProductos(d)),
      tablas: [
        { titulo: 'Productos más vendidos', cabeceras: ['Producto', 'Unidades'], filas: d.mas_vendidos.map((p) => [p.nombre, entero(p.unidades)]) },
        { titulo: 'Productos menos vendidos', cabeceras: ['Producto', 'Unidades'], filas: d.menos_vendidos.map((p) => [p.nombre, entero(p.unidades)]) },
        {
          titulo: 'Stock por variante',
          cabeceras: ['Producto', 'Material', 'Medida', 'Stock', 'Estado'],
          filas: d.variantes.map((v) => [v.producto, v.material, v.medida, v.stock, NOMBRE_ESTADO_STOCK[v.estado]]),
        },
      ],
      nota: `Stock bajo: ${d.umbral} unidades o menos (configurable en Configuración). El stock es el actual, no el del período.`,
    };
  }
  if (seccion === 'clientes') {
    const d = datos as PanelClientes;
    return {
      ...base,
      comparacion: comparar ? textoRango(d.anterior) : undefined,
      kpis: kpis(kpisClientes(d, comparar)),
      tablas: [
        { titulo: 'Clientes por nivel VIP', cabeceras: ['Nivel', 'Clientes'], filas: d.por_nivel.map((n) => [n.nivel, entero(n.clientes)]) },
        { titulo: 'Frecuencia de compra', cabeceras: ['Compras en el período', 'Clientes'], filas: d.frecuencia.map((f) => [f.etiqueta, entero(f.clientes)]) },
        {
          titulo: 'Clientes con más compras',
          cabeceras: ['Cliente', 'Nivel', 'Compras', 'Importe', 'Condiciones VIP'],
          filas: d.top_clientes.map((c) => [c.nombre, c.nivel, c.compras, dinero(c.importe), condicionVip(c)]),
        },
      ],
    };
  }
  if (seccion === 'rescate') {
    const d = datos as PanelRescate;
    return {
      ...base,
      comparacion: comparar ? textoRango(d.anterior) : undefined,
      kpis: kpis(kpisRescate(d, comparar)),
      tablas: [
        {
          titulo: 'Embudo de rescate',
          cabeceras: ['Etapa', 'Carritos'],
          filas: [['Abandonados', d.actual.abandonados], ['Notificados', d.actual.notificados], ['Recuperados', d.actual.recuperados]],
        },
        {
          titulo: 'Ventas recuperadas',
          cabeceras: ['Cliente', 'Aviso enviado', 'Compra', 'Importe'],
          filas: d.ventas_recuperadas.map((v) => [v.cliente, fechaHoraAR(v.fecha_aviso), fechaHoraAR(v.fecha_compra), dinero(v.monto)]),
        },
      ],
      nota: 'Tasa de recuperación = carritos recuperados ÷ carritos abandonados × 100.',
    };
  }
  const d = datos as EstadisticasEnvios;
  return {
    ...base,
    kpis: kpis(kpisEnvios(d)),
    tablas: [
      { titulo: 'Pedidos por provincia', cabeceras: ['Provincia', 'Pedidos', 'Monto'], filas: d.por_provincia.map((p) => [p.provincia, entero(p.cantidad), dinero(p.monto)]) },
      { titulo: 'Estado de los pedidos', cabeceras: ['Estado', 'Pedidos'], filas: d.por_estado.map((e) => [NOMBRE_ESTADO_ENVIO[e.estado] ?? e.estado, entero(e.cantidad)]) },
      {
        titulo: 'Pedidos por tipo de entrega',
        cabeceras: ['Tipo', 'Pedidos', 'Envío cobrado', 'Con envío gratis'],
        filas: d.por_tipo.map((t) => [nombreTipo(t.tipo), entero(t.cantidad), dinero(t.monto_envio), entero(t.con_envio_gratis)]),
      },
    ],
    nota: 'No incluye compras anteriores al módulo de envíos.',
  };
}

function filasComparacionVentas(d: PanelVentas): string[][] {
  const fila = (nombre: string, a: number, p: number, f: (n: number) => string) => [nombre, f(a), f(p), textoVariacion(variacion(a, p))];
  return [
    fila('Ingresos', d.actual.monto_total, d.previo.monto_total, dinero),
    fila('Ventas aprobadas', d.actual.cantidad, d.previo.cantidad, entero),
    fila('Ticket promedio', d.actual.ticket_promedio, d.previo.ticket_promedio, dinero),
    fila('Pendientes de pago', d.actual.pendientes, d.previo.pendientes, entero),
  ];
}

// ───────── piezas de diseño (todas las secciones usan la misma grilla) ─────────
function TarjetaKpi({ k }: { k: Kpi }) {
  const v = k.variacion ?? null;
  return (
    <div className="bg-white border border-stone-200 rounded-2xl p-5">
      <p className="text-sm text-stone-500">{k.titulo}</p>
      <p className="mt-2 text-2xl font-semibold text-stone-800">{k.valor}</p>
      {k.detalle && <p className="mt-1 text-xs text-stone-400">{k.detalle}</p>}
      {k.variacion !== undefined && (
        <p className={`mt-1 text-xs ${v === null || v === 0 ? 'text-stone-400' : v > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
          {textoVariacion(v)} vs. período anterior
        </p>
      )}
    </div>
  );
}

function Tarjeta({ titulo, children, nota }: { titulo: string; children: ReactNode; nota?: string }) {
  return (
    <div className="bg-white border border-stone-200 rounded-2xl p-5 h-full flex flex-col">
      <h2 className="font-serif text-lg text-stone-800 mb-4">{titulo}</h2>
      <div className="flex-1">{children}</div>
      {nota && <p className="mt-3 text-xs text-stone-400">{nota}</p>}
    </div>
  );
}

const Vacio = ({ texto }: { texto: string }) => <p className="text-sm text-stone-400 py-8 text-center">{texto}</p>;

function Tabla({ cabeceras, filas, vacio }: { cabeceras: string[]; filas: ReactNode[][]; vacio: string }) {
  if (filas.length === 0) return <Vacio texto={vacio} />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-stone-500 border-b border-stone-200">
            {cabeceras.map((c) => (
              <th key={c} className="py-2 pr-4 font-medium">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((f, i) => (
            <tr key={i} className="border-b border-stone-100 last:border-0 text-stone-700">
              {f.map((c, j) => (
                <td key={j} className="py-2 pr-4">{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Estructura({ kpis, izquierda, derecha, tabla }: { kpis: Kpi[]; izquierda: ReactNode; derecha: ReactNode; tabla: ReactNode }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k) => (
          <TarjetaKpi key={k.titulo} k={k} />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        {izquierda}
        {derecha}
      </div>
      {tabla}
    </div>
  );
}

// ───────── apartados ─────────
function SeccionVentas({ d, comparar }: { d: PanelVentas; comparar: boolean }) {
  const total = d.estados.reduce((a, e) => a + e.cantidad, 0);
  return (
    <Estructura
      kpis={kpisVentas(d, comparar)}
      izquierda={
        <Tarjeta titulo="Ingresos por día" nota={comparar ? 'Línea punteada: período anterior, alineado día a día.' : undefined}>
          {d.actual.cantidad === 0 && (!comparar || d.previo.cantidad === 0) ? (
            <Vacio texto="No hay ventas aprobadas en este período." />
          ) : (
            <GraficoLinea
              puntos={d.serie_actual.map((s) => ({ etiqueta: fechaAR(s.periodo).slice(0, 5), valor: s.monto }))}
              comparacion={comparar ? d.serie_anterior.map((s) => ({ etiqueta: fechaAR(s.periodo).slice(0, 5), valor: s.monto })) : undefined}
              formato={dineroCorto}
            />
          )}
        </Tarjeta>
      }
      derecha={
        <Tarjeta titulo="Comparación de períodos" nota={comparar ? `Anterior: ${textoRango(d.anterior)}` : undefined}>
          {comparar ? (
            <Tabla cabeceras={['Indicador', 'Actual', 'Anterior', 'Variación']} filas={filasComparacionVentas(d)} vacio="" />
          ) : (
            <Vacio texto="Activá “Comparar con el período anterior” para ver esta tabla." />
          )}
        </Tarjeta>
      }
      tabla={
        <Tarjeta titulo="Operaciones por estado">
          <Tabla
            cabeceras={['Estado', 'Cantidad', 'Importe', '% del total']}
            filas={d.estados.map((e) => [NOMBRE_ESTADO_COMPRA[e.estado], entero(e.cantidad), dinero(e.importe), total ? porcentaje((e.cantidad / total) * 100) : '0 %'])}
            vacio="No hay operaciones en este período."
          />
        </Tarjeta>
      }
    />
  );
}

function SeccionProductos({ d }: { d: PanelProductos }) {
  const [filtro, setFiltro] = useState<'todas' | 'stock_bajo' | 'sin_stock'>('todas');
  const filas = d.variantes.filter((v) => filtro === 'todas' || (filtro === 'stock_bajo' ? v.estado === 'stock_bajo' : v.estado === 'sin_stock'));
  const chip = (valor: typeof filtro, texto: string) => (
    <button
      key={valor}
      onClick={() => setFiltro(valor)}
      className={`px-3 py-1 rounded-full text-xs border transition-colors ${filtro === valor ? 'bg-cocoa-taupe text-white border-cocoa-taupe' : 'bg-white text-stone-600 border-stone-200 hover:border-cocoa-taupe'}`}
    >
      {texto}
    </button>
  );
  const ranking = (items: PanelProductos['mas_vendidos']) =>
    items.length === 0 ? <Vacio texto="No hay datos en este período." /> : <GraficoBarras items={items.map((p) => ({ etiqueta: p.nombre, valor: p.unidades }))} formato={(n) => `${entero(n)} u.`} />;
  const colorEstado = { ok: 'bg-emerald-50 text-emerald-700', stock_bajo: 'bg-amber-50 text-amber-700', sin_stock: 'bg-red-50 text-red-600' };
  return (
    <Estructura
      kpis={kpisProductos(d)}
      izquierda={<Tarjeta titulo="Productos más vendidos">{ranking(d.mas_vendidos)}</Tarjeta>}
      derecha={<Tarjeta titulo="Productos menos vendidos" nota="Incluye productos activos sin ventas en el período.">{ranking(d.menos_vendidos)}</Tarjeta>}
      tabla={
        <Tarjeta titulo="Stock por variante" nota={`Stock bajo: ${d.umbral} unidades o menos (se cambia en Configuración). Es el stock actual.`}>
          <div className="flex gap-2 mb-3 flex-wrap">
            {chip('todas', 'Todas')}
            {chip('stock_bajo', 'Stock bajo')}
            {chip('sin_stock', 'Sin stock')}
          </div>
          <Tabla
            cabeceras={['Producto', 'Material', 'Medida', 'Stock', 'Estado']}
            filas={filas.map((v) => [v.producto, v.material, v.medida, v.stock, <span key={v.id_variante} className={`px-2 py-0.5 rounded-full text-xs ${colorEstado[v.estado]}`}>{NOMBRE_ESTADO_STOCK[v.estado]}</span>])}
            vacio="No hay variantes en esta categoría."
          />
        </Tarjeta>
      }
    />
  );
}

function SeccionClientes({ d, comparar }: { d: PanelClientes; comparar: boolean }) {
  return (
    <Estructura
      kpis={kpisClientes(d, comparar)}
      izquierda={
        <Tarjeta titulo="Clientes por nivel VIP">
          {d.por_nivel.length === 0 ? <Vacio texto="No hay niveles configurados." /> : <GraficoBarras items={d.por_nivel.map((n) => ({ etiqueta: n.nivel, valor: n.clientes }))} formato={entero} />}
        </Tarjeta>
      }
      derecha={
        <Tarjeta titulo="Compradores recurrentes" nota="Cantidad de compras aprobadas por cliente dentro del período.">
          {d.compraron === 0 ? <Vacio texto="Nadie compró en este período." /> : <GraficoBarras items={d.frecuencia.map((f) => ({ etiqueta: f.etiqueta, valor: f.clientes }))} formato={(n) => `${entero(n)} ${n === 1 ? 'cliente' : 'clientes'}`} />}
        </Tarjeta>
      }
      tabla={
        <Tarjeta titulo="Clientes con más compras">
          <Tabla
            cabeceras={['Cliente', 'Nivel', 'Compras', 'Importe', 'Condiciones VIP']}
            filas={d.top_clientes.map((c) => [c.nombre, c.nivel, c.compras, dinero(c.importe), condicionVip(c)])}
            vacio="No hay compras en este período."
          />
        </Tarjeta>
      }
    />
  );
}

function SeccionRescate({ d, comparar }: { d: PanelRescate; comparar: boolean }) {
  return (
    <Estructura
      kpis={kpisRescate(d, comparar)}
      izquierda={
        <Tarjeta titulo="Embudo de rescate" nota="Tasa de recuperación = recuperados ÷ abandonados × 100">
          {d.actual.abandonados === 0 ? (
            <Vacio texto="No hubo carritos abandonados en este período." />
          ) : (
            <GraficoBarras
              items={[
                { etiqueta: 'Abandonados', valor: d.actual.abandonados },
                { etiqueta: 'Notificados', valor: d.actual.notificados },
                { etiqueta: 'Recuperados', valor: d.actual.recuperados },
              ]}
              formato={entero}
            />
          )}
        </Tarjeta>
      }
      derecha={
        <Tarjeta titulo="Tasa de recuperación por período" nota={comparar ? `Anterior: ${textoRango(d.anterior)}` : undefined}>
          <GraficoBarras
            items={[
              { etiqueta: 'Período seleccionado', valor: d.actual.tasa_recuperacion },
              ...(comparar ? [{ etiqueta: 'Período anterior', valor: d.previo.tasa_recuperacion }] : []),
            ]}
            formato={porcentaje}
          />
        </Tarjeta>
      }
      tabla={
        <Tarjeta titulo="Ventas recuperadas">
          <Tabla
            cabeceras={['Cliente', 'Aviso enviado', 'Compra', 'Importe']}
            filas={d.ventas_recuperadas.map((v) => [v.cliente, fechaHoraAR(v.fecha_aviso), fechaHoraAR(v.fecha_compra), dinero(v.monto)])}
            vacio="Todavía no se recuperó ninguna venta en este período."
          />
        </Tarjeta>
      }
    />
  );
}

function SeccionEnvios({ d }: { d: EstadisticasEnvios }) {
  return (
    <Estructura
      kpis={kpisEnvios(d)}
      izquierda={
        <Tarjeta titulo="Pedidos por provincia">
          {d.por_provincia.length === 0 ? <Vacio texto="No hay envíos a domicilio en este período." /> : <GraficoBarras items={d.por_provincia.map((p) => ({ etiqueta: p.provincia, valor: p.cantidad, extra: dinero(p.monto) }))} formato={(n) => `${entero(n)} ${n === 1 ? 'pedido' : 'pedidos'}`} />}
        </Tarjeta>
      }
      derecha={
        <Tarjeta titulo="Estado de los pedidos" nota="No incluye compras anteriores al módulo de envíos.">
          {d.por_estado.length === 0 ? <Vacio texto="No hay pedidos en este período." /> : <GraficoBarras items={d.por_estado.map((e) => ({ etiqueta: NOMBRE_ESTADO_ENVIO[e.estado] ?? e.estado, valor: e.cantidad }))} formato={entero} />}
        </Tarjeta>
      }
      tabla={
        <Tarjeta titulo="Pedidos por tipo de entrega">
          <Tabla
            cabeceras={['Tipo', 'Pedidos', 'Envío cobrado', 'Con envío gratis']}
            filas={d.por_tipo.map((t) => [nombreTipo(t.tipo), entero(t.cantidad), dinero(t.monto_envio), entero(t.con_envio_gratis)])}
            vacio="No hay pedidos en este período."
          />
        </Tarjeta>
      }
    />
  );
}

// ───────── página ─────────
type Resultado = { clave: string; datos: PanelEstadisticas[SeccionEstadisticas] } | { clave: string; error: string };

export default function AdminEstadisticasPage() {
  const { data: session } = useSession();
  const token = (session as { access_token?: string } | null)?.access_token;

  const [rango, setRango] = useState<Rango>(() => rangoDesdeHoy(29));
  const [preset, setPreset] = useState('Últimos 30 días');
  const [seccion, setSeccion] = useState<SeccionEstadisticas>('ventas');
  const [comparar, setComparar] = useState(true);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [exportando, setExportando] = useState(false);

  const meta = SECCIONES.find((s) => s.valor === seccion)!;
  const clave = `${seccion}|${rango.desde}|${rango.hasta}`;
  const rangoInvalido = !rango.desde || !rango.hasta || rango.desde > rango.hasta;

  useEffect(() => {
    if (!token || rangoInvalido) return;
    let activo = true;
    getEstadisticas(token, seccion, rango)
      .then((datos) => activo && setResultado({ clave, datos }))
      .catch((err) => activo && setResultado({ clave, error: err instanceof Error ? err.message : 'No se pudieron cargar las estadísticas' }));
    return () => {
      activo = false;
    };
  }, [token, seccion, rango, rangoInvalido, clave]);

  const actual = resultado && resultado.clave === clave ? resultado : null;
  const datos = actual && 'datos' in actual ? actual.datos : null;
  const error = actual && 'error' in actual ? actual.error : null;
  const cargando = !rangoInvalido && !actual;
  const compararActivo = comparar && meta.compara;

  const claseCampo = 'rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-700 focus:outline-none focus:border-dusty-rose';

  async function descargarPDF() {
    if (!datos) return;
    setExportando(true);
    try {
      const spec = especificacionPDF(seccion, datos, rango, compararActivo);
      const u = session?.user;
      spec.emitidoPor = u?.name ? `${u.name}${u.email ? ` (${u.email})` : ''}` : u?.email || undefined;
      await exportarPDF(spec, `estadisticas_${seccion}_${rango.desde}_a_${rango.hasta}`);
    } finally {
      setExportando(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-serif text-stone-800 mb-2">Estadísticas e informes</h1>
        <p className="text-sm text-stone-500">Solo se cuentan las compras con pago aprobado. Los días se toman en hora de Argentina.</p>
      </div>

      {/* Selector de apartado */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {SECCIONES.map((s) => (
          <button
            key={s.valor}
            onClick={() => setSeccion(s.valor)}
            className={`text-left rounded-2xl border p-4 flex flex-col gap-1 h-full transition-colors ${
              seccion === s.valor ? 'bg-cocoa-taupe text-white border-cocoa-taupe' : 'bg-white text-stone-700 border-stone-200 hover:border-cocoa-taupe'
            }`}
          >
            <span className="font-serif text-base">{s.titulo}</span>
            <span className={`text-xs ${seccion === s.valor ? 'text-white/80' : 'text-stone-400'}`}>{s.descripcion}</span>
          </button>
        ))}
      </div>

      {/* Barra común: período a la izquierda, comparar y Exportar PDF siempre a la derecha */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3 flex-wrap justify-between">
          <div className="flex gap-2 flex-wrap">
            {PRESETS.map((p) => (
              <button
                key={p.etiqueta}
                onClick={() => {
                  setRango(p.rango());
                  setPreset(p.etiqueta);
                }}
                className={`px-4 py-1.5 rounded-full text-sm border transition-colors ${
                  preset === p.etiqueta ? 'bg-dusty-rose text-white border-dusty-rose' : 'bg-white text-stone-600 border-stone-200 hover:border-cocoa-taupe'
                }`}
              >
                {p.etiqueta}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-4 ml-auto">
            <label
              className={`flex items-center gap-2 text-sm ${meta.compara ? 'text-stone-600' : 'text-stone-300'}`}
              title={meta.compara ? undefined : 'Este apartado muestra el estado actual, no se compara por período'}
            >
              <input type="checkbox" checked={compararActivo} disabled={!meta.compara} onChange={(e) => setComparar(e.target.checked)} />
              Comparar con el período anterior
            </label>
            <Button className="rounded-full" onClick={descargarPDF} disabled={!datos || exportando}>
              <FileDown className="w-4 h-4 mr-1" />
              {exportando ? 'Generando...' : 'Exportar PDF'}
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs text-stone-500">
            <span className="block mb-1">Desde</span>
            <input type="date" className={claseCampo} value={rango.desde} max={rango.hasta || undefined} onChange={(e) => { setRango({ ...rango, desde: e.target.value }); setPreset(''); }} />
          </label>
          <label className="text-xs text-stone-500">
            <span className="block mb-1">Hasta</span>
            <input type="date" className={claseCampo} value={rango.hasta} min={rango.desde || undefined} onChange={(e) => { setRango({ ...rango, hasta: e.target.value }); setPreset(''); }} />
          </label>
        </div>
        {rangoInvalido && <p className="text-sm text-red-500">Elegí un rango de fechas válido.</p>}
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}
      {cargando && <p className="text-sm text-stone-400">Cargando...</p>}

      {datos && seccion === 'ventas' && <SeccionVentas d={datos as PanelVentas} comparar={compararActivo} />}
      {datos && seccion === 'productos' && <SeccionProductos d={datos as PanelProductos} />}
      {datos && seccion === 'clientes' && <SeccionClientes d={datos as PanelClientes} comparar={compararActivo} />}
      {datos && seccion === 'rescate' && <SeccionRescate d={datos as PanelRescate} comparar={compararActivo} />}
      {datos && seccion === 'envios' && <SeccionEnvios d={datos as EstadisticasEnvios} />}
    </div>
  );
}
