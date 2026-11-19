'use client';
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, Gem, Heart } from 'lucide-react';
import { getMisFavoritos, type ProductoFavorito } from '@/lib/api';
import { useFavoritos } from '@/context/favoritos-context';
import BotonFavorito from '@/components/boton-favorito';

export default function MisFavoritosPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const token = (session as { access_token?: string } | null)?.access_token;
  const { ids } = useFavoritos();

  const [productos, setProductos] = useState<ProductoFavorito[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (status === 'loading') return;
    if (status !== 'authenticated') {
      router.push('/login');
      return;
    }
    getMisFavoritos(token as string)
      .then(setProductos)
      .catch((err) => setError(err instanceof Error ? err.message : 'No se pudieron cargar tus favoritos'))
      .finally(() => setCargando(false));
  }, [status, token, router]);

  // Al quitar un favorito (corazón) la tarjeta desaparece sin recargar
  const visibles = productos.filter((p) => ids.includes(p.id_producto));

  if (status === 'loading' || cargando) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <p className="text-stone-400">Cargando...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50">
      <nav className="bg-white border-b border-stone-200 px-8 py-4">
        <button
          onClick={() => router.push('/')}
          className="flex items-center gap-2 text-stone-600 hover:text-cocoa-taupe transition-colors text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver a la tienda
        </button>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-12">
        <h1 className="text-2xl font-serif text-stone-800 mb-8">Mis favoritos</h1>

        {error && <p className="text-red-500">{error}</p>}

        {!error && visibles.length === 0 && (
          <div className="bg-white border border-stone-200 rounded-2xl p-10 text-center">
            <Heart className="w-10 h-10 text-dusty-rose mx-auto mb-3" />
            <p className="text-stone-700 font-medium">Todavía no tenés favoritos</p>
            <p className="text-sm text-stone-500 mt-2">
              Tocá el corazón de una joya del catálogo para guardarla acá.
            </p>
            <Link href="/#catalogo" className="inline-block mt-6 text-sm text-cocoa-taupe underline">
              Ver catálogo
            </Link>
          </div>
        )}

        <div className="flex flex-col gap-4">
          {visibles.map((p) => (
            <Link key={p.id_producto} href={`/productos/${p.id_producto}`}>
              <div className="flex flex-col gap-5 overflow-hidden rounded-xl border border-stone-200 bg-white p-4 transition-all hover:border-dusty-rose hover:shadow-md sm:flex-row">
                <div className="relative aspect-square w-full shrink-0 overflow-hidden rounded-lg bg-blush-oat/30 sm:w-44">
                  {p.imagenes?.[0] ? (
                    <Image src={p.imagenes[0]} alt={p.nombre} fill sizes="(max-width: 640px) 100vw, 176px" className="object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <Gem className="h-10 w-10 text-dusty-rose" />
                    </div>
                  )}
                </div>

                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <span className="font-mono text-xs text-dusty-rose">{p.codigo_sku}</span>
                  <h3 className="font-serif text-xl text-espresso-brown">{p.nombre}</h3>
                  {p.descripcion && (
                    <p className="line-clamp-2 text-sm leading-relaxed text-stone-500">{p.descripcion}</p>
                  )}
                  {p.especificaciones.length > 0 && (
                    <dl className="mt-1 grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                      {p.especificaciones.map((e) => (
                        <div key={e.opcion} className="flex gap-2">
                          <dt className="text-stone-400">{e.opcion}:</dt>
                          <dd className="text-stone-700">{e.valores.join(', ')}</dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </div>

                <div className="flex shrink-0 flex-row items-center justify-between gap-3 sm:w-40 sm:flex-col sm:items-end sm:justify-between">
                  <BotonFavorito idProducto={p.id_producto} className="border border-stone-200" />
                  <div className="text-right">
                    {p.precio_desde != null && (
                      <p className="text-xl font-semibold text-espresso-brown">
                        {p.varios_precios && <span className="mr-1 text-sm font-normal text-stone-400">Desde</span>}
                        ${Math.round(p.precio_desde).toLocaleString('es-AR')}
                      </p>
                    )}
                    <p className={`text-xs ${p.disponible ? 'text-green-700' : 'text-red-500'}`}>
                      {p.disponible ? 'Disponible' : 'Sin stock'}
                    </p>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
