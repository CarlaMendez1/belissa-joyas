'use client';
import { useState } from 'react';
import { useCarrito } from '@/context/carrito-context';
import { X, ShoppingBag, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function CarritoSidebar() {
  const { carrito, abierto, setAbierto, eliminarItem, vaciarCarrito, iniciarPago } = useCarrito();
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState('');

  if (!abierto) return null;

  const items = carrito?.items || [];
  const subtotal = carrito?.precio_subtotal || 0;

  async function handleFinalizarCompra() {
    setProcesando(true);
    setError('');
    try {
      const init_point = await iniciarPago();
      window.location.href = init_point;
    } catch (err: any) {
      if (err.message === 'NO_AUTENTICADO') {
        setError('Iniciá sesión para finalizar la compra.');
      } else {
        setError('No se pudo iniciar el pago. Intentá de nuevo.');
      }
      setProcesando(false);
    }
  }

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/40 z-40"
        onClick={() => setAbierto(false)}
      />

      {/* Sidebar */}
      <div className="fixed right-0 top-0 h-full w-96 bg-white z-50 shadow-2xl flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-200">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-stone-700" />
            <h2 className="font-serif text-lg text-stone-800">Mi carrito</h2>
          </div>
          <button onClick={() => setAbierto(false)}>
            <X className="w-5 h-5 text-stone-500 hover:text-stone-800" />
          </button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-stone-400">
              <ShoppingBag className="w-12 h-12 opacity-30" />
              <p className="text-sm">Tu carrito está vacío</p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {items.map((item: any) => (
                <div key={item.id_item_carrito} className="flex items-center gap-4 p-3 bg-stone-50 rounded-lg">
                  <div className="w-12 h-12 bg-stone-200 rounded-md flex items-center justify-center flex-shrink-0">
                    <ShoppingBag className="w-5 h-5 text-stone-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-stone-800 truncate">
                      {item.variante?.codigo_sku}
                    </p>
                    <p className="text-xs text-stone-500">Cantidad: {item.cantidad}</p>
                    <p className="text-sm font-semibold text-amber-700">
                      ${Number(item.precio_unitario).toLocaleString('es-AR')}
                    </p>
                  </div>
                  <button
                    onClick={() => eliminarItem(item.id_variante)}
                    className="text-stone-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="px-6 py-4 border-t border-stone-200 flex flex-col gap-3">
            <div className="flex justify-between items-center">
              <span className="text-stone-600 text-sm">Subtotal</span>
              <span className="font-semibold text-stone-800 text-lg">
                ${Number(subtotal).toLocaleString('es-AR')}
              </span>
            </div>
            <Button
              onClick={handleFinalizarCompra}
              disabled={procesando}
              className="w-full bg-amber-700 hover:bg-amber-800 text-white rounded-full"
            >
              {procesando ? 'Redirigiendo...' : 'Finalizar compra'}
            </Button>
            {error && (
              <p className="text-xs text-red-500 text-center">{error}</p>
            )}
            <button
              onClick={vaciarCarrito}
              className="text-xs text-stone-400 hover:text-red-500 text-center transition-colors"
            >
              Vaciar carrito
            </button>
          </div>
        )}
      </div>
    </>
  );
}