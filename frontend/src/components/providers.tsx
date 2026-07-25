'use client';
import { SessionProvider } from 'next-auth/react';
import { CarritoProvider } from '@/context/carrito-context';
import CarritoSidebar from '@/components/carrito-sidebar';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <CarritoProvider>
        {children}
        <CarritoSidebar />
      </CarritoProvider>
    </SessionProvider>
  );
}