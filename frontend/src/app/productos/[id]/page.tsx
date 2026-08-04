'use client';
import { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { getProducto, getVariantesPorProducto, getOpciones } from '@/lib/api';
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
  const [seleccion, setSeleccion] = useState<Record<number, string>>({});
  const [opciones, setOpciones] = useState<any[]>([]);
  const [cantidad, setCantidad] = useState(1);
  const [agregando, setAgregando] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [requiereLogin, setRequiereLogin] = useState(false);

  useEffect(() => {
    if (id) {
      getProducto(Number(id)).then(setProducto);
      getOpciones().then(setOpciones);
      getVariantesPorProducto(Number(id)).then((data) => {
        setVariantes(data);
        if (data.length > 0) {
          setVarianteSeleccionada(data[0]);
          const inicial: Record<number, string> = {};
          data[0].caracteristicas?.forEach((c: any) => {
            inicial[c.id_opcion] = c.valor;
          });
          setSeleccion(inicial);
        }
      });
    }
  }, [id]);

  // Agrupa las características de todas las variantes por tipo de opción
  const gruposOpciones = useMemo(() => {
    const mapa: Record<number, Set<string>> = {};
    variantes.forEach((v: any) => {
      v.caracteristicas?.forEach((c: any) => {
        if (!mapa[c.id_opcion]) mapa[c.id_opcion] = new Set();
        mapa[c.id_opcion].add(c.valor);
      });
    });
    return Object.entries(mapa).map(([id_opcion, valores]) => ({
      id_opcion: Number(id_opcion),
      nombre: opciones.find((o: any) => o.id_opcion === Number(id_opcion))?.nombre || `Opción ${id_opcion}`,
      valores: Array.from(valores),
    }));
  }, [variantes, opciones]);

  function buscarVariante(sel: Record<number, string>) {
    return variantes.find((v: any) => {
      const caracts = v.caracteristicas || [];
      if (caracts.length !== Object.keys(sel).length) return false;
      return caracts.every((c: any) => sel[c.id_opcion] === c.valor);
    });
  }

  function handleSeleccionarOpcion(id_opcion: number, valor: string) {
    const nuevaSeleccion = { ...seleccion, [id_opcion]: valor };
    setSeleccion(nuevaSeleccion);
    const encontrada = buscarVariante(nuevaSeleccion);
    setVarianteSeleccionada(encontrada || null);
    setCantidad(1);
  }

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

            {/* Selectores agrupados por tipo de opción */}
            {gruposOpciones.map((grupo) => (
              <div key={grupo.id_opcion}>
                <p className="text-sm font-medium text-stone-700 mb-3">{grupo.nombre}:</p>
                <div className="flex flex-wrap gap-2">
                  {grupo.valores.map((valor) => {
                    const isSelected = seleccion[grupo.id_opcion] === valor;
                    return (
                      <button
                        key={valor}
                        type="button"
                        onClick={() => handleSeleccionarOpcion(grupo.id_opcion, valor)}
                        className={`px-4 py-2 rounded-lg border text-sm transition-all ${
                          isSelected
                            ? 'bg-amber-700 text-white border-amber-700'
                            : 'bg-white text-stone-700 border-stone-300 hover:border-amber-400'
                        }`}
                      >
                        {valor}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* Precio y stock, o aviso de combinación no disponible */}
            {varianteSeleccionada ? (
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
            ) : (
              <p className="text-sm text-stone-500 italic">
                Esta combinación no está disponible.
              </p>
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