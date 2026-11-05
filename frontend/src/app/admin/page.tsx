'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { getDashboardResumen, type DashboardResumen } from '@/lib/admin-api';
import { Package, FolderTree, Crown, ShoppingBag, Settings, SlidersHorizontal } from 'lucide-react';
import { tituloRegistro } from '@/lib/auditoria-utils';
const ACCIONES: Record<string, string> = { crear: 'creó', editar: 'editó', eliminar: 'eliminó' };

const ACCESOS = [
  { href: '/admin/productos', label: 'Productos', desc: 'Catálogo, variantes e imágenes', icon: Package },
  { href: '/admin/categorias', label: 'Categorías', desc: 'Categorías y subcategorías', icon: FolderTree },
  { href: '/admin/opciones', label: 'Opciones', desc: 'Opciones y características', icon: SlidersHorizontal },
  { href: '/admin/niveles-vip', label: 'Niveles VIP', desc: 'Beneficios y montos', icon: Crown },
  { href: '/admin/configuracion', label: 'Configuración', desc: 'Parámetros de la tienda', icon: Settings },
];

function formatoMoneda(n: number) {
  return n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });
}

function formatoFecha(iso: string) {
  return new Date(iso).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });
}

function Tarjeta({ titulo, valor, detalle, icon: Icon }: {
  titulo: string; valor: string | number; detalle?: string; icon: typeof Package;
}) {
  return (
    <div className="rounded-xl border border-blush-oat bg-white p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-cocoa-taupe">{titulo}</p>
        <span className="rounded-lg bg-blush-oat/50 p-2 text-cocoa-taupe"><Icon className="h-4 w-4" /></span>
      </div>
      <p className="mt-3 text-3xl font-semibold text-espresso-brown">{valor}</p>
      {detalle && <p className="mt-1 text-xs text-cocoa-taupe">{detalle}</p>}
    </div>
  );
}

export default function AdminInicioPage() {
  const { data: session } = useSession();
  const token = (session as any)?.access_token;

  const [datos, setDatos] = useState<DashboardResumen | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) return;
    setCargando(true);
    getDashboardResumen(token)
      .then(setDatos)
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false));
  }, [token]);

  const nombre = session?.user?.name;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-espresso-brown">
          {nombre ? `Hola, ${nombre}` : 'Inicio'}
        </h1>
        <p className="text-sm text-cocoa-taupe">Resumen de tu tienda</p>
      </div>

      {error && (
        <p className="rounded-lg border border-dusty-rose bg-blush-oat/40 px-4 py-3 text-sm text-espresso-brown">
          No se pudo cargar el resumen: {error}
        </p>
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Tarjeta titulo="Productos activos" valor={cargando ? '…' : datos?.productos_activos ?? '—'} icon={Package} />
        <Tarjeta titulo="Categorías" valor={cargando ? '…' : datos?.categorias ?? '—'} icon={FolderTree} />
        <Tarjeta
          titulo="Clientes VIP"
          valor={cargando ? '…' : datos?.clientes_vip.total ?? '—'}
          detalle={datos?.clientes_vip.por_nivel.map((n) => `${n.nivel ?? 'Sin nivel'}: ${n.cantidad}`).join(' · ')}
          icon={Crown}
        />
        <Tarjeta
          titulo={`Ventas confirmadas (${datos?.ventas_confirmadas.dias ?? 30} días)`}
          valor={cargando ? '…' : datos?.ventas_confirmadas.cantidad ?? '—'}
          detalle={datos ? formatoMoneda(datos.ventas_confirmadas.monto_total) : undefined}
          icon={ShoppingBag}
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 text-lg font-medium text-espresso-brown">Accesos rápidos</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {ACCESOS.map(({ href, label, desc, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="flex items-start gap-3 rounded-xl border border-blush-oat bg-white p-4 transition hover:border-dusty-rose hover:bg-milk"
              >
                <span className="rounded-lg bg-blush-oat/50 p-2 text-cocoa-taupe"><Icon className="h-4 w-4" /></span>
                <span>
                  <span className="block text-sm font-medium text-espresso-brown">{label}</span>
                  <span className="block text-xs text-cocoa-taupe">{desc}</span>
                </span>
              </Link>
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-medium text-espresso-brown">Actividad reciente</h2>
          <div className="rounded-xl border border-blush-oat bg-white">
            {cargando ? (
              <p className="p-4 text-sm text-cocoa-taupe">Cargando…</p>
            ) : !datos || datos.actividad_reciente.length === 0 ? (
              <p className="p-4 text-sm text-cocoa-taupe">Todavía no hay actividad registrada.</p>
            ) : (
              <ul className="divide-y divide-blush-oat">
                {datos.actividad_reciente.map((a) => (
                  <li key={a.id_log} className="px-4 py-3 text-sm">
                    <p className="text-espresso-brown">
                      <span className="font-medium">{a.usuario ?? 'Sistema'}</span> {ACCIONES[a.accion] ?? a.accion}{' '}
                      {tituloRegistro(a)}
                    </p>
                    <p className="text-xs text-cocoa-taupe">{formatoFecha(a.fecha)}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}