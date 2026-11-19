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

      <div className="max-w-5xl mx-auto px-6 py-12">
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

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {visibles.map((p) => (
            <Link key={p.id_producto} href={`/productos/${p.id_producto}`}>
              <div className="overflow-hidden rounded-xl border border-stone-200 bg-white transition-all hover:border-dusty-rose hover:shadow-md">
                <div className="relative aspect-square bg-blush-oat/30">
                  <BotonFavorito idProducto={p.id_producto} className="absolute right-3 top-3 z-10" />
                  {p.imagenes?.[0] ? (
                    <Image src={p.imagenes[0]} alt={p.nombre} fill sizes="(max-width: 768px) 100vw, 33vw" className="object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <Gem className="h-12 w-12 text-dusty-rose" />
                    </div>
                  )}
                </div>
                <div className="p-5">
                  <span className="font-mono text-xs text-dusty-rose">{p.codigo_sku}</span>
                  <h3 className="font-serif text-lg text-espresso-brown">{p.nombre}</h3>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
