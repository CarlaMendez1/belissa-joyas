'use client';
import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { Heart } from 'lucide-react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

type FavoritosCtx = {
  ids: number[];
  esFavorito: (id_producto: number) => boolean;
  alternar: (id_producto: number) => Promise<void>;
};

const FavoritosContext = createContext<FavoritosCtx | null>(null);

export function FavoritosProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const token = (session as { access_token?: string } | null)?.access_token;
  const [idsGuardados, setIds] = useState<number[]>([]);
  const [aviso, setAviso] = useState<{ texto: string; conLink: boolean } | null>(null);
  // Sin sesión no hay favoritos, aunque quedaran guardados de una sesión anterior
  const ids = status === 'authenticated' ? idsGuardados : [];

  useEffect(() => {
    if (status !== 'authenticated' || !token) return;
    fetch(`${API}/favoritos/ids`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setIds(Array.isArray(data) ? data : []))
      .catch(() => setIds([]));
  }, [status, token]);

  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(null), 3000);
    return () => clearTimeout(t);
  }, [aviso]);

  const esFavorito = useCallback((id: number) => ids.includes(id), [ids]);

  const alternar = useCallback(
    async (id: number) => {
      if (!token) throw new Error('NO_AUTENTICADO');
      const era = ids.includes(id);
      // Actualiza la pantalla de inmediato y revierte si el servidor falla
      setIds((prev) => (era ? prev.filter((x) => x !== id) : [...prev, id]));
      const res = await fetch(`${API}/favoritos/${id}`, {
        method: era ? 'DELETE' : 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        setIds((prev) => (era ? [...prev, id] : prev.filter((x) => x !== id)));
        setAviso({ texto: 'No se pudo actualizar tus favoritos', conLink: false });
        throw new Error('ERROR_SERVIDOR');
      }
      setAviso(era ? { texto: 'Quitado de tus favoritos', conLink: false } : { texto: 'Agregado a tus favoritos', conLink: true });
    },
    [token, ids],
  );

  return (
    <FavoritosContext.Provider value={{ ids, esFavorito, alternar }}>
      {children}
      {aviso && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 left-1/2 z-[60] flex -translate-x-1/2 items-center gap-3 rounded-lg border border-stone-200 bg-white px-4 py-2.5 text-sm text-stone-700 shadow-md"
        >
          <Heart className="h-4 w-4 text-dusty-rose" />
          <span>{aviso.texto}</span>
          {aviso.conLink && (
            <Link href="/mi-cuenta/favoritos" className="font-medium text-cocoa-taupe underline">
              Ver favoritos
            </Link>
          )}
        </div>
      )}
    </FavoritosContext.Provider>
  );
}

export function useFavoritos() {
  const ctx = useContext(FavoritosContext);
  if (!ctx) throw new Error('useFavoritos debe usarse dentro de FavoritosProvider');
  return ctx;
}
