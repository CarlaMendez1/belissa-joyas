'use client';
import { useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useCarrito } from '@/context/carrito-context';
import { CheckCircle2, ShoppingBag } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function PagoExitoPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { cargarCarrito } = useCarrito();

  const paymentId = searchParams.get('payment_id');
  const ventaId = searchParams.get('external_reference');

  useEffect(() => {
    // El carrito ya fue marcado como "convertido" por el webhook del backend.
    // Refrescamos el estado local para que el sidebar deje de mostrar esos ítems.
    cargarCarrito();
  }, []);

  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-stone-200 p-8 text-center flex flex-col items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
          <CheckCircle2 className="w-9 h-9 text-green-600" />
        </div>
        <h1 className="text-2xl font-serif text-stone-800">¡Pago aprobado!</h1>
        <p className="text-stone-500 leading-relaxed">
          Tu compra se realizó con éxito. Te enviaremos un email con los detalles de tu pedido.
        </p>
        {ventaId && (
          <p className="text-xs text-stone-400 font-mono">
            Pedido #{ventaId}{paymentId ? ` · Pago #${paymentId}` : ''}
          </p>
        )}
        <Button
          onClick={() => router.push('/')}
          className="w-full mt-4 bg-amber-700 hover:bg-amber-800 text-white rounded-full flex items-center justify-center gap-2"
        >
          <ShoppingBag className="w-4 h-4" />
          Volver al catálogo
        </Button>
      </div>
    </div>
  );
}