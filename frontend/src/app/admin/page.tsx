'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { Banknote, Users, PackageX, Crown, Truck, CircleCheck, ShoppingCart, TrendingUp, type LucideIcon } from 'lucide-react';
import { GraficoLinea } from '@/components/graficos';
import { getDashboardResumen, type DashboardResumen } from '@/lib/admin-api';

type Resultado = { datos: DashboardResumen } | { error: string };

const dinero = (n: number) => `$${Math.round(n).toLocaleString('es-AR')}`;
const dineroCorto = (n: number) =>
  n >= 1_000_000
    ? `$${(n / 1_000_000).toLocaleString('es-AR', { maximumFractionDigits: 1 })} M`
    : n >= 1000
      ? `$${Math.round(n / 1000).toLocaleString('es-AR')} mil`
      : `$${Math.round(n)}`;

// Colores de la torta: del más oscuro al más claro (la leyenda también lleva el porcentaje)
const COLORES_TORTA = ['#7b5e57', '#b98b82', '#d9b8a8', '#e9d9cc', '#c9b6a8'];

function haceCuanto(iso: string) {
  const minutos = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  const rtf = new Intl.RelativeTimeFormat('es', { numeric: 'auto' });
  if (minutos < 60) return rtf.format(-Math.max(minutos, 1), 'minute');
  const horas = Math.round(minutos / 60);
  if (horas < 24) return rtf.format(-horas, 'hour');
  return rtf.format(-Math.round(horas / 24), 'day');
}

function fechaDeHoy() {
  const texto = new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

const INSIGNIA = {
  ambar: 'bg-amber-100 text-amber-900',
  verde: 'bg-emerald-100 text-emerald-900',
  rojo: 'bg-red-100 text-red-900',
};

function Insignia({ tono, children }: { tono: keyof typeof INSIGNIA; children: React.ReactNode }) {
  return <span className={`whitespace-nowrap rounded-full px-3 py-1 text-xs ${INSIGNIA[tono]}`}>{children}</span>;
}

const TONOS = {
  verde: { caja: 'bg-emerald-100 text-emerald-900', icono: 'bg-emerald-100 text-emerald-800' },
  ambar: { caja: 'bg-amber-100 text-amber-900', icono: 'bg-amber-100 text-amber-800' },
  rojo: { caja: 'bg-red-100 text-red-900', icono: 'bg-red-100 text-red-800' },
  neutro: { caja: 'bg-blush-oat/60 text-cocoa-taupe', icono: 'bg-blush-oat/60 text-cocoa-taupe' },
};

function Tarjeta({
  titulo,
  valor,
  detalle,
  etiqueta,
  tono,
  icono: Icono,
  alerta,
}: {
  titulo: string;
  valor: string;
  detalle: string;
  etiqueta: string;
  tono: keyof typeof TONOS;
  icono: LucideIcon;
  alerta?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-blush-oat bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-cocoa-taupe">{titulo}</p>
        <span className={`flex h-9 w-9 flex-none items-center justify-center rounded-xl ${TONOS[tono].icono}`}>
          <Icono className="h-5 w-5" aria-hidden="true" />
        </span>
      </div>
      <p className={`mt-1 font-sans text-3xl font-semibold ${alerta ? 'text-red-700' : 'text-espresso-brown'}`}>{valor}</p>
      <p className="mt-1 text-xs text-cocoa-taupe">{detalle}</p>
      <span className={`mt-3 inline-block rounded-full px-3 py-1 text-xs ${TONOS[tono].caja}`}>{etiqueta}</span>
    </div>
  );
}

function Torta({ items }: { items: { categoria: string; monto: number }[] }) {
  const total = items.reduce((acc, i) => acc + i.monto, 0);
  const RADIO = 56;
  const LARGO = 2 * Math.PI * RADIO;
  const partes = items.map((i, n) => {
    const antes = items.slice(0, n).reduce((acc, x) => acc + x.monto, 0);
    return {
      ...i,
      largo: (i.monto / total) * LARGO,
      desfase: -(antes / total) * LARGO,
      color: COLORES_TORTA[n % COLORES_TORTA.length],
      pct: (i.monto / total) * 100,
    };
  });
  return (
    <div className="flex flex-wrap items-center justify-center gap-5 pt-2">
      <svg viewBox="0 0 160 160" width="150" height="150" role="img" aria-label="Ingresos por categoría">
        <g transform="rotate(-90 80 80)" fill="none" strokeWidth="26">
          {partes.map((p) => (
            <circle key={p.categoria} cx="80" cy="80" r={RADIO} stroke={p.color} strokeDasharray={`${p.largo} ${LARGO}`} strokeDashoffset={p.desfase}>
              <title>{`${p.categoria}: ${dinero(p.monto)}`}</title>
            </circle>
          ))}
        </g>
      </svg>
      <ul className="space-y-2 text-sm text-espresso-brown">
        {partes.map((p) => (
          <li key={p.categoria} className="flex items-center gap-2">
            <span className="h-3 w-3 rounded" style={{ background: p.color, border: '1px solid #d6c8bc' }} />
            {p.categoria}
            <b className="ml-1 font-sans font-semibold">{Math.round(p.pct)}%</b>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Bloque({
  titulo,
  enlace,
  children,
}: {
  titulo: string;
  enlace?: { href: string; texto: string };
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-blush-oat bg-white p-5">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 className="text-lg text-espresso-brown">{titulo}</h2>
        {enlace && (
          <Link href={enlace.href} className="text-sm text-cocoa-taupe underline-offset-2 hover:underline">
            {enlace.texto}
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

const Vacio = ({ texto }: { texto: string }) => <p className="py-4 text-sm text-cocoa-taupe">{texto}</p>;

export default function AdminInicioPage() {
  const { data: session } = useSession();
  const token = (session as { access_token?: string } | null)?.access_token;
  const nombre = session?.user?.name?.split(' ')[0];

  const [resultado, setResultado] = useState<Resultado | null>(null);

  useEffect(() => {
    if (!token) return;
    let activo = true;
    getDashboardResumen(token)
      .then((datos) => activo && setResultado({ datos }))
      .catch((e) => activo && setResultado({ error: e instanceof Error ? e.message : 'No se pudo cargar' }));
    return () => {
      activo = false;
    };
  }, [token]);

  const datos = resultado && 'datos' in resultado ? resultado.datos : null;
  const error = resultado && 'error' in resultado ? resultado.error : null;

  return (
    <div className="space-y-7">
      <div>
        <h1 className="text-3xl text-espresso-brown">{nombre ? `Hola, ${nombre}` : 'Inicio'}</h1>
        {datos && <p className="mt-1 text-sm text-cocoa-taupe">{fechaDeHoy()} · Esto es lo que necesita tu atención hoy</p>}
      </div>

      {error && (
        <p className="rounded-lg border border-dusty-rose bg-blush-oat/40 px-4 py-3 text-sm text-espresso-brown">
          No se pudo cargar el resumen: {error}
        </p>
      )}
      {!datos && !error && <p className="text-sm text-cocoa-taupe">Cargando…</p>}

      {datos && (
        <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Tarjeta
              titulo="Ventas del mes"
              valor={dinero(datos.ventas_mes.monto)}
              detalle={`${datos.ventas_mes.cantidad} ${datos.ventas_mes.cantidad === 1 ? 'pedido confirmado' : 'pedidos confirmados'}`}
              etiqueta={
                datos.ventas_mes.variacion_porcentaje === null
                  ? 'Sin mes anterior para comparar'
                  : `${datos.ventas_mes.variacion_porcentaje >= 0 ? '+' : ''}${datos.ventas_mes.variacion_porcentaje}% vs. mes anterior`
              }
              tono={datos.ventas_mes.variacion_porcentaje === null ? 'neutro' : datos.ventas_mes.variacion_porcentaje >= 0 ? 'verde' : 'rojo'}
              icono={Banknote}
            />
            <Tarjeta
              titulo="Usuarios activos"
              valor={String(datos.usuarios_activos.total)}
              detalle="con cuenta activa en la tienda"
              etiqueta={`${datos.usuarios_activos.nuevos_mes} nuevos este mes`}
              tono="neutro"
              icono={Users}
            />
            <Tarjeta
              titulo="Alertas de stock"
              valor={`${datos.stock_critico.total} ${datos.stock_critico.total === 1 ? 'variante' : 'variantes'}`}
              detalle={`con ${datos.stock_critico.umbral} unidades o menos`}
              etiqueta={datos.stock_critico.sin_stock > 0 ? `${datos.stock_critico.sin_stock} sin stock` : 'Todas con stock'}
              tono={datos.stock_critico.sin_stock > 0 ? 'rojo' : datos.stock_critico.total > 0 ? 'ambar' : 'verde'}
              icono={PackageX}
              alerta={datos.stock_critico.total > 0}
            />
            <Tarjeta
              titulo="Clientes VIP activos"
              valor={String(datos.clientes_vip.total)}
              detalle="en el programa de fidelización"
              etiqueta={`${datos.clientes_vip.nuevos_mes} nuevos este mes`}
              tono="neutro"
              icono={Crown}
            />
          </section>

          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Tarjeta
              titulo="Pedidos por despachar"
              valor={String(datos.pedidos_por_despachar.total)}
              detalle="pagados, esperando acción"
              etiqueta={datos.pedidos_por_despachar.total > 0 ? 'Pendiente' : 'Al día'}
              tono={datos.pedidos_por_despachar.total > 0 ? 'ambar' : 'verde'}
              icono={Truck}
            />
            <Tarjeta
              titulo="Pedidos entregados"
              valor={String(datos.pedidos_entregados_mes)}
              detalle="en lo que va del mes"
              etiqueta="Completo"
              tono="verde"
              icono={CircleCheck}
            />
            <Tarjeta
              titulo="Carritos abandonados"
              valor={String(datos.carritos_abandonados.total)}
              detalle="con productos sin comprar"
              etiqueta={datos.carritos_abandonados.total > 0 ? 'Por recuperar' : 'Ninguno'}
              tono={datos.carritos_abandonados.total > 0 ? 'ambar' : 'verde'}
              icono={ShoppingCart}
            />
            <Tarjeta
              titulo="Tasa de conversión"
              valor={datos.tasa_conversion.porcentaje === null ? '—' : `${datos.tasa_conversion.porcentaje.toLocaleString('es-AR')}%`}
              detalle="compras sobre carritos del mes"
              etiqueta={`${datos.tasa_conversion.carritos} carritos este mes`}
              tono="neutro"
              icono={TrendingUp}
            />
          </section>

          <div className="flex flex-wrap items-stretch gap-6">
            <div className="grid w-full grid-cols-1 items-stretch gap-6 lg:grid-cols-2">
            <Bloque titulo="Ventas de los últimos 30 días" enlace={{ href: '/admin/estadisticas', texto: 'Ver estadísticas' }}>
              {datos.ventas_30_dias.every((d) => d.monto === 0) ? (
                <Vacio texto="No hay ventas en los últimos 30 días." />
              ) : (
                <GraficoLinea
                  puntos={datos.ventas_30_dias.map((d) => {
                    const [, mes, dia] = d.dia.split('-').map(Number);
                    return { etiqueta: `${dia}/${mes}`, valor: d.monto };
                  })}
                  formato={dineroCorto}
                />
              )}
            </Bloque>

            <Bloque
              titulo={`Pedidos por despachar${datos.pedidos_por_despachar.total > 0 ? ` (${datos.pedidos_por_despachar.total})` : ''}`}
              enlace={{ href: '/admin/pedidos', texto: 'Ver todos' }}
            >
              {datos.pedidos_por_despachar.items.length === 0 ? (
                <Vacio texto="No hay pedidos pendientes. ¡Todo al día!" />
              ) : (
                <ul className="divide-y divide-blush-oat">
                  {datos.pedidos_por_despachar.items.map((p) => (
                    <li key={p.id_venta} className="flex flex-wrap items-center justify-between gap-2 py-3">
                      <div>
                        <p className="text-sm text-espresso-brown">
                          Pedido #{p.id_venta} · {p.cliente}
                        </p>
                        <p className="text-xs text-cocoa-taupe">
                          {p.tipo_entrega === 'retiro'
                            ? 'Retiro en local'
                            : `Envío a domicilio${p.provincia ? ` · ${p.provincia}` : ''}`}{' '}
                          · {haceCuanto(p.fecha)}
                        </p>
                      </div>
                      {p.estado_envio === 'retiro_listo' ? (
                        <Insignia tono="verde">Listo para retirar</Insignia>
                      ) : (
                        <Insignia tono="ambar">Pendiente de despacho</Insignia>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </Bloque>

            <Bloque titulo="Stock crítico" enlace={{ href: '/admin/productos', texto: 'Ver productos' }}>
              {datos.stock_critico.items.length === 0 ? (
                <Vacio texto="Ninguna variante con poco stock." />
              ) : (
                <ul className="divide-y divide-blush-oat">
                  {datos.stock_critico.items.map((s) => (
                    <li key={s.id_variante} className="flex items-center justify-between gap-3 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm text-espresso-brown">{s.nombre}</p>
                        <p className="truncate text-xs text-cocoa-taupe">{s.detalle}</p>
                      </div>
                      <div className="flex items-center gap-4">
                        {s.stock <= 0 ? (
                          <Insignia tono="rojo">Sin stock</Insignia>
                        ) : (
                          <Insignia tono="ambar">{s.stock === 1 ? 'Queda 1' : `Quedan ${s.stock}`}</Insignia>
                        )}
                        <Link
                          href={`/admin/productos/${s.id_producto}`}
                          className="text-sm text-cocoa-taupe underline-offset-2 hover:underline"
                        >
                          Editar
                        </Link>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Bloque>

            <Bloque titulo="Carritos abandonados">
              {datos.carritos_abandonados.items.length === 0 ? (
                <Vacio texto="No hay carritos abandonados." />
              ) : (
                <ul className="divide-y divide-blush-oat">
                  {datos.carritos_abandonados.items.map((c) => (
                    <li key={c.id_carrito} className="flex justify-between gap-3 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm text-espresso-brown">{c.cliente}</p>
                        <p className="truncate text-xs text-cocoa-taupe">
                          {c.productos} {c.productos === 1 ? 'producto' : 'productos'} · {haceCuanto(c.fecha)}
                          {c.mail_enviado ? ' · mail enviado' : ''}
                        </p>
                      </div>
                      <p className="whitespace-nowrap font-sans text-sm font-semibold text-espresso-brown">
                        {dinero(c.monto)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </Bloque>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
