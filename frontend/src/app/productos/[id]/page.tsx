'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { getProducto, getVariantesPorProducto } from '@/lib/api';
import { useCarrito } from '@/context/carrito-context';
import { Gem, ArrowLeft, ShoppingBag, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ProductoPage() {
  const { id } = useParams();
  const router = useRouter();
  const { status } = useSession();
  const { agregarItem } = useCarrito();

  const [producto, setProducto] = useState<any>(null);
  const [variantes, setVariantes] = useState<any[]>([]);
  const [varianteSeleccionada, setVarianteSeleccionada] = useState<any>(null);
  const [cantidad, setCantidad] = useState(1);
  const [agregando, setAgregando] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [requiereLogin, setRequiereLogin] = useState(false);

  useEffect(() => {
    if (id) {
      getProducto(Number(id)).then(setProducto);
      getVariantesPorProducto(Number(id)).then((data) => {
        setVariantes(data);
        if (data.length > 0) setVarianteSeleccionada(data[0]);
      });
    }
  }, [id]);

  async function handleAgregarAlCarrito() {
    if (!varianteSeleccionada) return;

    if (status !== 'authenticated') {
      setMensaje('Iniciá sesión para agregar productos al carrito.');
      setRequiereLogin(true);
      return;
    }

    setAgregando(true);
    setMensaje('');
    setRequiereLogin(false);
    try {
      await agregarItem(varianteSeleccionada.id_variante, cantidad);
      setMensaje('¡Producto agregado al carrito!');
    } catch (err: any) {
      if (err?.message === 'NO_AUTENTICADO') {
        setMensaje('Iniciá sesión para agregar productos al carrito.');
        setRequiereLogin(true);
      } else {
        setMensaje('Error al agregar el producto. Intentá de nuevo.');
      }
    }
    setAgregando(false);
  }

  if (!producto) return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50">
      <p className="text-stone-400">Cargando producto...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-stone-50">

      {/* Navbar simple */}
      <nav className="bg-white border-b border-stone-200 px-8 py-4">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-stone-600 hover:text-amber-700 transition-colors text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver al catálogo
        </button>
      </nav>

      <div className="max-w-5xl mx-auto px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">

          {/* Imagen del producto */}
          <div className="bg-gradient-to-br from-stone-100 to-amber-50 rounded-2xl flex items-center justify-center h-96">
            <Gem className="w-24 h-24 text-amber-600 opacity-60" />
          </div>

          {/* Info del producto */}
          <div className="flex flex-col gap-6">
            <div>
              <p className="text-xs text-amber-700 font-mono mb-2">{producto.codigo_sku}</p>
              <h1 className="text-3xl font-serif text-stone-800 mb-3">{producto.nombre}</h1>
              <p className="text-stone-500 leading-relaxed">{producto.descripcion}</p>
            </div>

            {/* Selector de variantes */}
            {variantes.length > 0 && (
              <div>
                <p className="text-sm font-medium text-stone-700 mb-3">Seleccioná una variante:</p>
                <div className="flex flex-wrap gap-2">
                  {variantes.map((v: any) => (
                    <button
                      key={v.id_variante}
                      type="button"
                      onClick={() => setVarianteSeleccionada(v)}
                      className={`px-4 py-2 rounded-lg border text-sm transition-all ${
                        varianteSeleccionada?.id_variante === v.id_variante
                          ? 'bg-amber-700 text-white border-amber-700'
                          : 'bg-white text-stone-700 border-stone-300 hover:border-amber-400'
                      }`}
                    >
                      {v.codigo_sku}
                      {v.caracteristicas?.length > 0 && (
                        <span className="ml-1 text-xs opacity-75">
                          ({v.caracteristicas.map((c: any) => c.valor).join(', ')})
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Precio y stock */}
            {varianteSeleccionada && (
              <div className="bg-white rounded-xl p-4 border border-stone-200">
                <div className="flex justify-between items-center">
                  <span className="text-2xl font-semibold text-stone-800">
                    ${Number(varianteSeleccionada.precio_venta).toLocaleString('es-AR')}
                  </span>
                  <div className="flex items-center gap-2 text-sm text-stone-500">
                    <Package className="w-4 h-4" />
                    <span>Stock: {varianteSeleccionada.stock_disponible}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Control de cantidad */}
            <div className="flex items-center gap-4">
              <p className="text-sm font-medium text-stone-700">Cantidad:</p>
              <div className="flex items-center border border-stone-300 rounded-lg overflow-hidden">
                <button
                  type="button"
                  onClick={() => setCantidad(Math.max(1, cantidad - 1))}
                  className="px-3 py-2 text-stone-600 hover:bg-stone-100 transition-colors"
                >−</button>
                <span className="px-4 py-2 text-stone-800 font-medium min-w-8 text-center">{cantidad}</span>
                <button
                  type="button"
                  onClick={() => setCantidad(Math.min(varianteSeleccionada?.stock_disponible || 10, cantidad + 1))}
                  className="px-3 py-2 text-stone-600 hover:bg-stone-100 transition-colors"
                >+</button>
              </div>
            </div>

            {/* Botón agregar al carrito */}
            <Button
              onClick={handleAgregarAlCarrito}
              disabled={agregando || !varianteSeleccionada || varianteSeleccionada.stock_disponible === 0}
              className="w-full bg-amber-700 hover:bg-amber-800 text-white py-3 rounded-full flex items-center justify-center gap-2"
            >
              <ShoppingBag className="w-4 h-4" />
              {agregando ? 'Agregando...' : 'Agregar al carrito'}
            </Button>

            {/* Mensaje de confirmación */}
            {mensaje && (
              <p className={`text-sm text-center ${
                mensaje.includes('Error') || requiereLogin ? 'text-red-500' : 'text-green-600'
              }`}>
                {mensaje}
                {requiereLogin && (
                  <>
                    {' '}
                    <button
                      onClick={() => router.push('/login')}
                      className="underline font-medium"
                    >
                      Ir a login
                    </button>
                  </>
                )}
              </p>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}