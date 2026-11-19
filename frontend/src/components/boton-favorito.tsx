'use client';
import { Heart } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useFavoritos } from '@/context/favoritos-context';

export default function BotonFavorito({ idProducto, className = '' }: { idProducto: number; className?: string }) {
  const { status } = useSession();
  const router = useRouter();
  const { esFavorito, alternar } = useFavoritos();
  const activo = esFavorito(idProducto);

  async function onClick(e: React.MouseEvent) {
    // El botón vive dentro de tarjetas que son enlaces: no debe navegar
    e.preventDefault();
    e.stopPropagation();
    if (status !== 'authenticated') {
      router.push('/login');
      return;
    }
    try {
      await alternar(idProducto);
    } catch {
      // el contexto ya revirtió el cambio
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      aria-label={activo ? 'Quitar de favoritos' : 'Agregar a favoritos'}
      title={activo ? 'Quitar de favoritos' : 'Agregar a favoritos'}
      className={`flex h-9 w-9 items-center justify-center rounded-full bg-white/90 shadow-sm transition-colors hover:bg-white ${className}`}
    >
      <Heart className={`h-5 w-5 ${activo ? 'fill-red-500 text-red-500' : 'text-stone-500'}`} />
    </button>
  );
}
