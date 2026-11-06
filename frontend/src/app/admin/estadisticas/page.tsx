'use client';
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GraficoLinea, GraficoBarras } from '@/components/graficos';
import { descargarCSV } from '@/lib/csv';
import { getEstadisticas, type Agrupacion, type Estadisticas } from '@/lib/admin-api';

type Seccion = 'ventas' | 'productos' | 'envios';

const SECCIONES: { valor: Seccion; etiqueta: string }[] = [
  { valor: 'ventas', etiqueta: 'Ventas' },
  { valor: 'productos', etiqueta: 'Productos y categorías' },
  { valor: 'envios', etiqueta: 'Envíos y pedidos' },
];

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

const dinero = (n: number) => `$${Math.round(n).toLocaleString('es-AR')}`;
const dineroCorto = (n: number) =>
  n >= 1_000_000 ? `$${(n / 1_000_000).toLocaleString('es-AR', { maximumFractionDigits: 1 })} M` : n >= 1000 ? `$${Math.round(n / 1000).toLocaleString('es-AR')} mil` : `$${Math.round(n)}`;
const entero = (n: number) => Math.round(n).toLocaleString('es-AR');

function aISO(d: Date) {
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mes}-${dia}`;
}

function rangoDesdeHoy(diasAtras: number) {
  const hasta = new Date();
  const desde = new Date();
  desde.setDate(desde.getDate() - diasAtras);
  return { desde: aISO(desde), hasta: aISO(hasta) };
}

const PRESETS: { etiqueta: string; rango: () => { desde: string; hasta: string }; agrupar: Agrupacion }[] = [
  { etiqueta: 'Últimos 7 días', rango: () => rangoDesdeHoy(6), agrupar: 'dia' },
  { etiqueta: 'Últimos 30 días', rango: () => rangoDesdeHoy(29), agrupar: 'dia' },
  {
    etiqueta: 'Este mes',
    rango: () => {
      const hoy = new Date();
      return { desde: aISO(new Date(hoy.getFullYear(), hoy.getMonth(), 1)), hasta: aISO(hoy) };
    },
    agrupar: 'dia',
  },
  {
    etiqueta: 'Mes pasado',
    rango: () => {
      const hoy = new Date();
      return {
        desde: aISO(new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1)),
        hasta: aISO(new Date(hoy.getFullYear(), hoy.getMonth(), 0)),
      };
    },
    agrupar: 'dia',
  },
  {
    etiqueta: 'Este año',
    rango: () => {
      const hoy = new Date();
      return { desde: aISO(new Date(hoy.getFullYear(), 0, 1)), hasta: aISO(hoy) };
    },
    agrupar: 'mes',
  },
];

function etiquetaPeriodo(periodo: string, agrupar: Agrupacion) {
  const [anio, mes, dia] = periodo.split('-').map(Number);
  if (agrupar === 'mes') return `${MESES[mes - 1]} ${String(anio).slice(2)}`;
  return `${dia}/${mes}`;
}

function nombreTipo(tipo: string) {
  return tipo === 'domicilio' ? 'Envío a domicilio' : tipo === 'retiro' ? 'Retiro en local' : tipo;
}

function nombreEstado(estado: string) {
  const nombres: Record<string, string> = {
    pendiente_despacho: 'Pendientes de despacho',
    despachado: 'Despachados',
    retiro_listo: 'Listos para retirar',
    entregado: 'Entregados',
  };
  return nombres[estado] ?? estado;
}

function duracion(horas: number | null, dias: number | null) {
  if (horas !== null) return horas >= 48 ? `${(horas / 24).toLocaleString('es-AR', { maximumFractionDigits: 1 })} días` : `${horas.toLocaleString('es-AR', { maximumFractionDigits: 1 })} h`;
  if (dias !== null) return `${dias.toLocaleString('es-AR', { maximumFractionDigits: 1 })} días`;
  return 'Sin datos';
}

type Resultado = { clave: string; datos: Estadisticas } | { clave: string; error: string };

export default function AdminEstadisticasPage() {
  const { data: session } = useSession();
  const token = (session as { access_token?: string } | null)?.access_token;

  const [rango, setRango] = useState(() => rangoDesdeHoy(29));
  const [agrupar, setAgrupar] = useState<Agrupacion>('dia');
  const [seccion, setSeccion] = useState<Seccion>('ventas');
  const [metrica, setMetrica] = useState<'monto' | 'cantidad'>('monto');
  const [resultado, setResultado] = useState<Resultado | null>(null);

  const clave = `${rango.desde}|${rango.hasta}|${agrupar}`;

  useEffect(() => {
    if (!token || !rango.desde || !rango.hasta || rango.desde > rango.hasta) return;
    let activo = true;
    getEstadisticas(token, { desde: rango.desde, hasta: rango.hasta, agrupar })
      .then((datos) => activo && setResultado({ clave, datos }))
      .catch(
        (err) =>
          activo &&
          setResultado({ clave, error: err instanceof Error ? err.message : 'No se pudieron cargar las estadísticas' }),
      );
    return () => {
      activo = false;
    };
  }, [token, rango.desde, rango.hasta, agrupar, clave]);

  const rangoInvalido = !rango.desde || !rango.hasta || rango.desde > rango.hasta;
  const cargando = !rangoInvalido && (!resultado || resultado.clave !== clave);
  const actual = resultado && resultado.clave === clave ? resultado : null;
  const datos = actual && 'datos' in actual ? actual.datos : null;
  const error = actual && 'error' in actual ? actual.error : null;

  const claseCampo =
    'rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-700 focus:outline-none focus:border-dusty-rose';
  const periodoTxt = `${rango.desde}_a_${rango.hasta}`;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-serif text-stone-800 mb-2">Estadísticas</h1>
        <p className="text-sm text-stone-500">
          Solo se cuentan las compras ya pagadas. Los días se toman en hora de Argentina.
        </p>
      </div>

      {/* Filtros */}
      <div className="flex flex-col gap-3">
        <div className="flex gap-2 flex-wrap">
          {PRESETS.map((p) => (
            <button
              key={p.etiqueta}
              onClick={() => {
                setRango(p.rango());
                setAgrupar(p.agrupar);
              }}
              className="px-4 py-1.5 rounded-full text-sm border bg-white text-stone-600 border-stone-200 hover:border-cocoa-taupe transition-colors"
            >
              {p.etiqueta}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs text-stone-500">
            <span className="block mb-1">Desde</span>
            <input
              type="date"
              className={claseCampo}
              value={rango.desde}
              max={rango.hasta || undefined}
              onChange={(e) => setRango({ ...rango, desde: e.target.value })}
            />
          </label>
          <label className="text-xs text-stone-500">
            <span className="block mb-1">Hasta</span>
            <input
              type="date"
              className={claseCampo}
              value={rango.hasta}
              min={rango.desde || undefined}
              onChange={(e) => setRango({ ...rango, hasta: e.target.value })}
            />
          </label>
          {seccion === 'ventas' && (
            <label className="text-xs text-stone-500">
              <span className="block mb-1">Agrupar por</span>
              <select className={claseCampo} value={agrupar} onChange={(e) => setAgrupar(e.target.value as Agrupacion)}>
                <option value="dia">Día</option>
                <option value="semana">Semana</option>
                <option value="mes">Mes</option>
              </select>
            </label>
          )}
        </div>
        {rangoInvalido && <p className="text-sm text-red-500">Elegí un rango de fechas válido.</p>}
      </div>

      {/* Secciones */}
      <div className="flex gap-2 flex-wrap border-b border-stone-200 pb-3">
        {SECCIONES.map((s) => (
          <button
            key={s.valor}
            onClick={() => setSeccion(s.valor)}
            className={`px-4 py-1.5 rounded-full text-sm border transition-colors ${
              seccion === s.valor
                ? 'bg-cocoa-taupe text-white border-cocoa-taupe'
                : 'bg-white text-stone-600 border-stone-200 hover:border-cocoa-taupe'
            }`}
          >
            {s.etiqueta}
          </button>
        ))}
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}
      {cargando && <p className="text-sm text-stone-400">Cargando...</p>}

      {datos && seccion === 'ventas' && (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Tarjeta titulo="Ventas" valor={entero(datos.ventas.resumen.cantidad)} />
            <Tarjeta titulo="Total facturado" valor={dinero(datos.ventas.resumen.monto_total)} detalle="Productos + envío" />
            <Tarjeta titulo="Ticket promedio" valor={dinero(datos.ventas.resumen.ticket_promedio)} />
            <Tarjeta titulo="Envíos cobrados" valor={dinero(datos.ventas.resumen.monto_envio)} />
          </div>

          <div className="bg-white border border-stone-200 rounded-2xl p-5">
            <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
              <h2 className="font-serif text-lg text-stone-800">Evolución de las ventas</h2>
              <div className="flex items-center gap-2">
                <select
                  className={claseCampo}
                  value={metrica}
                  onChange={(e) => setMetrica(e.target.value as 'monto' | 'cantidad')}
                >
                  <option value="monto">Monto ($)</option>
                  <option value="cantidad">Cantidad de ventas</option>
                </select>
                <BotonCSV
                  onClick={() =>
                    descargarCSV(
                      `ventas_${periodoTxt}`,
                      ['Período', 'Cantidad de ventas', 'Monto total'],
                      datos.ventas.serie.map((s) => [s.periodo, s.cantidad, s.monto]),
                    )
                  }
                />
              </div>
            </div>
            {datos.ventas.resumen.cantidad === 0 ? (
              <p className="text-sm text-stone-400 py-8 text-center">No hay ventas en este período.</p>
            ) : (
              <GraficoLinea
                puntos={datos.ventas.serie.map((s) => ({
                  etiqueta: etiquetaPeriodo(s.periodo, datos.ventas.agrupar),
                  valor: metrica === 'monto' ? s.monto : s.cantidad,
                }))}
                formato={metrica === 'monto' ? dineroCorto : entero}
              />
            )}
          </div>
        </div>
      )}

      {datos && seccion === 'productos' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white border border-stone-200 rounded-2xl p-5">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h2 className="font-serif text-lg text-stone-800">Productos más vendidos</h2>
              <BotonCSV
                onClick={() =>
                  descargarCSV(
                    `productos_mas_vendidos_${periodoTxt}`,
                    ['Producto', 'Unidades', 'Monto a precio de lista'],
                    datos.productos.mas_vendidos.map((p) => [p.nombre, p.unidades, p.monto]),
                  )
                }
              />
            </div>
            {datos.productos.mas_vendidos.length === 0 ? (
              <p className="text-sm text-stone-400 py-8 text-center">No hay ventas en este período.</p>
            ) : (
              <GraficoBarras
                items={datos.productos.mas_vendidos.map((p) => ({
                  etiqueta: p.nombre,
                  valor: p.unidades,
                  extra: dinero(p.monto),
                }))}
                formato={(n) => `${entero(n)} u.`}
                detalle="Los montos son a precio de lista, antes del descuento VIP."
              />
            )}
          </div>

          <div className="bg-white border border-stone-200 rounded-2xl p-5">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h2 className="font-serif text-lg text-stone-800">Ventas por categoría</h2>
              <BotonCSV
                onClick={() =>
                  descargarCSV(
                    `ventas_por_categoria_${periodoTxt}`,
                    ['Categoría', 'Unidades', 'Monto a precio de lista'],
                    datos.productos.por_categoria.map((c) => [c.categoria, c.unidades, c.monto]),
                  )
                }
              />
            </div>
            {datos.productos.por_categoria.length === 0 ? (
              <p className="text-sm text-stone-400 py-8 text-center">No hay ventas en este período.</p>
            ) : (
              <GraficoBarras
                items={datos.productos.por_categoria.map((c) => ({
                  etiqueta: c.categoria,
                  valor: c.monto,
                  extra: `${entero(c.unidades)} u.`,
                }))}
                formato={dinero}
                detalle="Montos a precio de lista, antes del descuento VIP."
              />
            )}
          </div>
        </div>
      )}

      {datos && seccion === 'envios' && (
        <div className="flex flex-col gap-6">
          <EnviosResumen datos={datos} />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white border border-stone-200 rounded-2xl p-5">
              <div className="flex items-center justify-between gap-3 mb-4">
                <h2 className="font-serif text-lg text-stone-800">Pedidos por provincia</h2>
                <BotonCSV
                  onClick={() =>
                    descargarCSV(
                      `pedidos_por_provincia_${periodoTxt}`,
                      ['Provincia', 'Pedidos', 'Monto total'],
                      datos.envios.por_provincia.map((p) => [p.provincia, p.cantidad, p.monto]),
                    )
                  }
                />
              </div>
              {datos.envios.por_provincia.length === 0 ? (
                <p className="text-sm text-stone-400 py-8 text-center">No hay envíos a domicilio en este período.</p>
              ) : (
                <GraficoBarras
                  items={datos.envios.por_provincia.map((p) => ({
                    etiqueta: p.provincia,
                    valor: p.cantidad,
                    extra: dinero(p.monto),
                  }))}
                  formato={(n) => `${entero(n)} ${n === 1 ? 'pedido' : 'pedidos'}`}
                />
              )}
            </div>

            <div className="bg-white border border-stone-200 rounded-2xl p-5">
              <div className="flex items-center justify-between gap-3 mb-4">
                <h2 className="font-serif text-lg text-stone-800">Estado de los pedidos</h2>
                <BotonCSV
                  onClick={() =>
                    descargarCSV(
                      `pedidos_por_estado_${periodoTxt}`,
                      ['Estado', 'Pedidos'],
                      datos.envios.por_estado.map((e) => [nombreEstado(e.estado), e.cantidad]),
                    )
                  }
                />
              </div>
              {datos.envios.por_estado.length === 0 ? (
                <p className="text-sm text-stone-400 py-8 text-center">No hay pedidos en este período.</p>
              ) : (
                <GraficoBarras
                  items={datos.envios.por_estado.map((e) => ({ etiqueta: nombreEstado(e.estado), valor: e.cantidad }))}
                  formato={(n) => entero(n)}
                  detalle="No incluye compras anteriores al módulo de envíos."
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EnviosResumen({ datos }: { datos: Estadisticas }) {
  const { por_tipo, horas_hasta_despacho, dias_hasta_entrega } = datos.envios;
  const domicilio = por_tipo.find((t) => t.tipo === 'domicilio');
  const retiro = por_tipo.find((t) => t.tipo === 'retiro');
  const total = por_tipo.reduce((acc, t) => acc + t.cantidad, 0);

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <Tarjeta titulo="Pedidos con entrega" valor={entero(total)} />
      <Tarjeta
        titulo={nombreTipo('domicilio')}
        valor={entero(domicilio?.cantidad ?? 0)}
        detalle={`${entero(domicilio?.con_envio_gratis ?? 0)} con envío gratis · ${nombreTipo('retiro')}: ${entero(retiro?.cantidad ?? 0)}`}
      />
      <Tarjeta titulo="Tiempo hasta el despacho" valor={duracion(horas_hasta_despacho, null)} detalle="Promedio desde la compra" />
      <Tarjeta titulo="Tiempo hasta la entrega" valor={duracion(null, dias_hasta_entrega)} detalle="Promedio desde la compra" />
    </div>
  );
}

function Tarjeta({ titulo, valor, detalle }: { titulo: string; valor: string; detalle?: string }) {
  return (
    <div className="bg-white border border-stone-200 rounded-2xl p-5">
      <p className="text-sm text-stone-500">{titulo}</p>
      <p className="mt-2 text-2xl font-semibold text-stone-800">{valor}</p>
      {detalle && <p className="mt-1 text-xs text-stone-400">{detalle}</p>}
    </div>
  );
}

function BotonCSV({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="outline" size="sm" className="rounded-full" onClick={onClick}>
      <Download className="w-4 h-4 mr-1" />
      Excel (CSV)
    </Button>
  );
}
