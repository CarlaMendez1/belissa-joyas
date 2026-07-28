'use client';
import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useSession } from 'next-auth/react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const CarritoContext = createContext<any>(null);

export function CarritoProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const [carrito, setCarrito] = useState<any>(null);
  const [abierto, setAbierto] = useState(false);

  const token = (session as any)?.access_token;

  const cargarCarrito = useCallback(async () => {
    if (!token) return;
    const res = await fetch(`${API}/carrito`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    setCarrito(data);
  }, [token]);

  useEffect(() => {
    if (status === 'authenticated' && token) {
      cargarCarrito();
    }
    if (status === 'unauthenticated') {
      setCarrito(null);
    }
  }, [status, token, cargarCarrito]);

  const agregarItem = async (id_variante: number, cantidad: number) => {
    if (!token) throw new Error('NO_AUTENTICADO');
    const res = await fetch(`${API}/carrito/item`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id_variante, cantidad }),
    });
    if (!res.ok) throw new Error('ERROR_SERVIDOR');
    const data = await res.json();
    setCarrito(data);
    setAbierto(true);
  };

  const eliminarItem = async (id_variante: number) => {
    if (!token) throw new Error('NO_AUTENTICADO');
    const res = await fetch(`${API}/carrito/item/${id_variante}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error('ERROR_SERVIDOR');
    const data = await res.json();
    setCarrito(data);
  };

  const vaciarCarrito = async () => {
    if (!token) throw new Error('NO_AUTENTICADO');
    const res = await fetch(`${API}/carrito/vaciar`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error('ERROR_SERVIDOR');
    setCarrito(null);
  };

  const totalItems = carrito?.items?.reduce((acc: number, i: any) => acc + i.cantidad, 0) || 0;

  return (
    <CarritoContext.Provider value={{
      carrito, abierto, setAbierto, totalItems,
      cargarCarrito, agregarItem, eliminarItem, vaciarCarrito,
    }}>
      {children}
    </CarritoContext.Provider>
  );
}

export const useCarrito = () => {
  const context = useContext(CarritoContext);
  if (!context) throw new Error('useCarrito debe usarse dentro de CarritoProvider');
  return context;
};