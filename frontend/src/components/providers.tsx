'use client';
import { SessionProvider } from 'next-auth/react';
import { CarritoProvider } from '@/context/carrito-context';
import { FavoritosProvider } from '@/context/favoritos-context';
import CarritoSidebar from '@/components/carrito-sidebar';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <CarritoProvider>
        <FavoritosProvider>
          {children}
          <CarritoSidebar />
        </FavoritosProvider>
      </CarritoProvider>
    </SessionProvider>
  );
}