'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useCarrito } from '@/context/carrito-context';
import { X, ShoppingBag, Trash2, Pencil, Truck, Store, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  getOpcionesEntrega,
  getMisDirecciones,
  getResumenCheckout,
  type Direccion,
  type OpcionesEntrega,
  type ResumenCheckout,
  type TipoEntrega,
} from '@/lib/api';

const plata = (n: number | string) => `$${Number(n).toLocaleString('es-AR')}`;

type ItemCarritoVista = {
  id_item_carrito: number;
  id_variante: number;
  cantidad: number;
  precio_unitario: number | string;
  variante?: {
    codigo_sku?: string;
    id_producto?: number;
    imagenes?: string[] | null;
    producto?: { nombre?: string; imagenes?: string[] | null };
  };
};

// Misma regla que la página del producto: la foto de la variante y, si no tiene, la del producto
function imagenDe(item: ItemCarritoVista): string | undefined {
  const deVariante = (item.variante?.imagenes ?? []).filter(Boolean);
  if (deVariante.length > 0) return deVariante[0];
  return (item.variante?.producto?.imagenes ?? []).filter(Boolean)[0];
}

export default function CarritoSidebar() {
  const { carrito, abierto, setAbierto, eliminarItem, vaciarCarrito, iniciarPago } = useCarrito();
  const { data: session } = useSession();
  const token = (session as { access_token?: string } | null)?.access_token;

  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState('');

  // Entrega
  const [opciones, setOpciones] = useState<OpcionesEntrega | null>(null);
  const [direcciones, setDirecciones] = useState<Direccion[]>([]);
  const [tipoEntrega, setTipoEntrega] = useState<TipoEntrega | null>(null);
  const [idDireccion, setIdDireccion] = useState<number | null>(null);
  // Cada resultado se guarda con la selección para la que se calculó, así nunca se
  // muestra un total viejo después de cambiar de dirección, de tipo de entrega o de carrito.
  const [calculado, setCalculado] = useState<{ clave: string; resumen?: ResumenCheckout; error?: string } | null>(null);
  const [errorCarga, setErrorCarga] = useState('');

  const items: ItemCarritoVista[] = carrito?.items || [];
  const subtotal = carrito?.precio_subtotal || 0;
  const firmaItems = items.map((i) => `${i.id_variante}:${i.cantidad}`).join(',');

  // Al abrir el carrito se traen las opciones de entrega y las direcciones del cliente
  // (se vuelven a pedir cada vez, así una dirección recién cargada aparece enseguida).
  useEffect(() => {
    if (!abierto || !token) return;
    let cancelado = false;
    Promise.all([getOpcionesEntrega(), getMisDirecciones(token)])
      .then(([ops, dirs]) => {
        if (cancelado) return;
        setOpciones(ops);
        setDirecciones(dirs);
        setIdDireccion((actual) => {
          if (actual && dirs.some((d) => d.id_direccion === actual)) return actual;
          return (dirs.find((d) => d.es_predeterminada) ?? dirs[0])?.id_direccion ?? null;
        });
        setTipoEntrega((actual) => {
          if (actual === 'retiro' && !ops.retiro_local_activo) return dirs.length ? 'domicilio' : null;
          if (actual) return actual;
          if (dirs.length > 0) return 'domicilio';
          return ops.retiro_local_activo ? 'retiro' : 'domicilio';
        });
      })
      .catch(() => {
        if (!cancelado) setErrorCarga('No se pudieron cargar las opciones de entrega.');
      });
    return () => {
      cancelado = true;
    };
  }, [abierto, token]);

  // Resumen de lo que va a pagar (lo calcula el servidor: descuento VIP + envío)
  const hayQueCalcular =
    abierto && !!token && !!tipoEntrega && items.length > 0 && !(tipoEntrega === 'domicilio' && !idDireccion);
  const claveActual = `${tipoEntrega}|${idDireccion}|${firmaItems}`;

  useEffect(() => {
    if (!hayQueCalcular || !token || !tipoEntrega) return;
    let cancelado = false;
    getResumenCheckout(token, {
      tipo_entrega: tipoEntrega,
      ...(tipoEntrega === 'domicilio' && idDireccion ? { id_direccion: idDireccion } : {}),
    })
      .then((r) => {
        if (!cancelado) setCalculado({ clave: claveActual, resumen: r });
      })
      .catch((err) => {
        if (!cancelado) {
          setCalculado({
            clave: claveActual,
            error: err instanceof Error ? err.message : 'No se pudo calcular el envío.',
          });
        }
      });
    return () => {
      cancelado = true;
    };
  }, [hayQueCalcular, token, tipoEntrega, idDireccion, claveActual]);

  if (!abierto) return null;

  const vigente = hayQueCalcular && calculado?.clave === claveActual ? calculado : null;
  const resumenVigente = vigente?.resumen ?? null;
  const errorResumen = vigente?.error || errorCarga;
  const calculando = hayQueCalcular && !vigente;
  const puedePagar = !!resumenVigente && !procesando;

  async function handleFinalizarCompra() {
    if (!tipoEntrega) return;
    setProcesando(true);
    setError('');
    try {
      const init_point = await iniciarPago({
        tipo_entrega: tipoEntrega,
        ...(tipoEntrega === 'domicilio' && idDireccion ? { id_direccion: idDireccion } : {}),
      });
      window.location.href = init_point;
    } catch (err) {
      const mensaje = err instanceof Error ? err.message : '';
      if (mensaje === 'NO_AUTENTICADO') {
        setError('Iniciá sesión para finalizar la compra.');
      } else if (mensaje && mensaje !== 'ERROR_SERVIDOR') {
        setError(mensaje);
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
      <div className="fixed right-0 top-0 h-full w-96 max-w-full bg-white z-50 shadow-2xl flex flex-col">

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

        {/* Items + entrega */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-stone-400">
              <ShoppingBag className="w-12 h-12 opacity-30" />
              <p className="text-sm">Tu carrito está vacío</p>
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-4">
                {items.map((item) => (
                  <div key={item.id_item_carrito} className="flex items-center gap-4 p-3 bg-stone-50 rounded-lg">
                                        <div className="w-12 h-12 bg-stone-200 rounded-md flex items-center justify-center flex-shrink-0 overflow-hidden">
                      {imagenDe(item) ? (
                        <img
                          src={imagenDe(item)}
                          alt={item.variante?.producto?.nombre ?? 'Producto'}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <ShoppingBag className="w-5 h-5 text-stone-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-stone-800 truncate">
                        {item.variante?.producto?.nombre ?? item.variante?.codigo_sku}
                      </p>
                      <p className="text-xs text-stone-500">Cantidad: {item.cantidad}</p>
                      <p className="text-sm font-semibold text-cocoa-taupe">
                        {plata(item.precio_unitario)}
                      </p>
                    </div>
                                        {item.variante?.id_producto && (
                      <Link
                        href={`/productos/${item.variante.id_producto}`}
                        onClick={() => setAbierto(false)}
                        title="Modificar cantidad"
                        className="text-stone-400 hover:text-cocoa-taupe transition-colors"
                      >
                        <Pencil className="w-4 h-4" />
                      </Link>
                    )}
                    <button
                      onClick={() => eliminarItem(item.id_variante)}
                      title="Quitar del carrito"
                      className="text-stone-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Entrega */}
              <div className="flex flex-col gap-3">
                <h3 className="text-sm font-medium text-stone-800">¿Cómo querés recibirlo?</h3>

                <button
                  type="button"
                  onClick={() => setTipoEntrega('domicilio')}
                  className={`flex items-start gap-3 rounded-lg border px-4 py-3 text-left transition-colors ${
                    tipoEntrega === 'domicilio' ? 'border-cocoa-taupe bg-blush-oat/30' : 'border-stone-200 hover:border-stone-300'
                  }`}
                >
                  <Truck className="w-4 h-4 mt-0.5 text-cocoa-taupe" />
                  <div>
                    <p className="text-sm text-stone-800">Envío a domicilio</p>
                    {opciones && opciones.envio_gratis_desde > 0 && (
                      <p className="text-xs text-stone-500">
                        Gratis en compras desde {plata(opciones.envio_gratis_desde)}
                      </p>
                    )}
                  </div>
                </button>

                {tipoEntrega === 'domicilio' && (
                  <div className="ml-1 flex flex-col gap-2">
                    {direcciones.length === 0 ? (
                      <p className="text-xs text-stone-500">Todavía no cargaste ninguna dirección.</p>
                    ) : (
                      direcciones.map((d) => (
                        <label
                          key={d.id_direccion}
                          className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-xs cursor-pointer ${
                            idDireccion === d.id_direccion ? 'border-cocoa-taupe bg-white' : 'border-stone-200'
                          }`}
                        >
                          <input
                            type="radio"
                            name="direccion-envio"
                            className="mt-0.5"
                            checked={idDireccion === d.id_direccion}
                            onChange={() => setIdDireccion(d.id_direccion)}
                          />
                          <span className="text-stone-600">
                            <span className="font-medium text-stone-800">{d.nombre_destinatario}</span>
                            <br />
                            {d.calle} {d.numero}
                            {d.piso_depto ? `, ${d.piso_depto}` : ''} · {d.localidad}, {d.provincia?.nombre}
                          </span>
                        </label>
                      ))
                    )}
                    <Link
                      href="/mi-cuenta/direcciones"
                      onClick={() => setAbierto(false)}
                      className="flex items-center gap-1 text-xs text-cocoa-taupe hover:underline"
                    >
                      <MapPin className="w-3 h-3" />
                      {direcciones.length === 0 ? 'Agregar una dirección' : 'Administrar mis direcciones'}
                    </Link>
                  </div>
                )}

                {opciones?.retiro_local_activo && (
                  <button
                    type="button"
                    onClick={() => setTipoEntrega('retiro')}
                    className={`flex items-start gap-3 rounded-lg border px-4 py-3 text-left transition-colors ${
                      tipoEntrega === 'retiro' ? 'border-cocoa-taupe bg-blush-oat/30' : 'border-stone-200 hover:border-stone-300'
                    }`}
                  >
                    <Store className="w-4 h-4 mt-0.5 text-cocoa-taupe" />
                    <div>
                      <p className="text-sm text-stone-800">Retiro en local (sin costo)</p>
                      {opciones.retiro_local_direccion && (
                        <p className="text-xs text-stone-500">{opciones.retiro_local_direccion}</p>
                      )}
                    </div>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="px-6 py-4 border-t border-stone-200 flex flex-col gap-3">
            {resumenVigente ? (
              <div className="flex flex-col gap-1 text-sm">
                <div className="flex justify-between text-stone-600">
                  <span>
                    Productos
                    {resumenVigente.descuento_vip_porcentaje > 0 && ` (−${resumenVigente.descuento_vip_porcentaje}% VIP)`}
                  </span>
                  <span>{plata(resumenVigente.subtotal_productos)}</span>
                </div>
                <div className="flex justify-between text-stone-600">
                  <span>
                    {tipoEntrega === 'retiro' ? 'Retiro en local' : 'Envío'}
                    {resumenVigente.plazo_dias ? ` · ${resumenVigente.plazo_dias} días` : ''}
                  </span>
                  <span>{resumenVigente.costo_envio === 0 ? 'Gratis' : plata(resumenVigente.costo_envio)}</span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-stone-100">
                  <span className="text-stone-700">Total</span>
                  <span className="font-semibold text-stone-800 text-lg">{plata(resumenVigente.total)}</span>
                </div>
              </div>
            ) : (
              <div className="flex justify-between items-center">
                <span className="text-stone-600 text-sm">Subtotal</span>
                <span className="font-semibold text-stone-800 text-lg">{plata(subtotal)}</span>
              </div>
            )}

            {calculando && <p className="text-xs text-stone-400 text-center">Calculando...</p>}
            {tipoEntrega === 'domicilio' && !idDireccion && (
              <p className="text-xs text-stone-500 text-center">Elegí o cargá una dirección para ver el total.</p>
            )}
            {errorResumen && <p className="text-xs text-red-500 text-center">{errorResumen}</p>}

            <Button
              onClick={handleFinalizarCompra}
              disabled={!puedePagar}
              className="w-full bg-cocoa-taupe hover:bg-espresso-brown text-white rounded-full"
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
