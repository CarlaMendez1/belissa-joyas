'use client';
import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useSession } from 'next-auth/react';

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
  // Sin sesión no hay favoritos, aunque quedaran guardados de una sesión anterior
  const ids = status === 'authenticated' ? idsGuardados : [];

  useEffect(() => {
    if (status !== 'authenticated' || !token) return;
    fetch(`${API}/favoritos/ids`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setIds(Array.isArray(data) ? data : []))
      .catch(() => setIds([]));
  }, [status, token]);

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
        throw new Error('ERROR_SERVIDOR');
      }
    },
    [token, ids],
  );

  return <FavoritosContext.Provider value={{ ids, esFavorito, alternar }}>{children}</FavoritosContext.Provider>;
}

export function useFavoritos() {
  const ctx = useContext(FavoritosContext);
  if (!ctx) throw new Error('useFavoritos debe usarse dentro de FavoritosProvider');
  return ctx;
}
