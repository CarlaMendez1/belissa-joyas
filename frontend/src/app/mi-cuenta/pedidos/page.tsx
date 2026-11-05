'use client';
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ChevronDown, ChevronRight, Check, Package } from 'lucide-react';
import { getMisPedidos, type MiPedido } from '@/lib/api';

function dinero(n: number) {
  return `$${n.toLocaleString('es-AR')}`;
}

function fecha(iso: string | null) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });
}

function textoEstado(p: MiPedido): { texto: string; clase: string } {
  switch (p.estado_envio) {
    case 'pendiente_despacho':
      return { texto: 'Preparando tu pedido', clase: 'bg-amber-100 text-amber-800' };
    case 'despachado':
      return { texto: 'En camino', clase: 'bg-blue-100 text-blue-800' };
    case 'retiro_listo':
      return { texto: 'Listo para retirar', clase: 'bg-purple-100 text-purple-800' };
    case 'entregado':
      return { texto: 'Entregado', clase: 'bg-green-100 text-green-800' };
    default:
      return { texto: 'Compra confirmada', clase: 'bg-stone-100 text-stone-700' };
  }
}

// Pasos del pedido según cómo se entrega. Devuelve cuántos ya se cumplieron.
function pasosDe(p: MiPedido): { etiquetas: string[]; cumplidos: number } | null {
  if (!p.tipo_entrega || !p.estado_envio) return null;
  const etiquetas =
    p.tipo_entrega === 'retiro'
      ? ['Pago confirmado', 'Listo para retirar', 'Entregado']
      : ['Pago confirmado', 'Despachado', 'Entregado'];
  const cumplidos =
    p.estado_envio === 'pendiente_despacho' ? 1 : p.estado_envio === 'entregado' ? 3 : 2;
  return { etiquetas, cumplidos };
}

export default function MisPedidosPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const token = (session as { access_token?: string } | null)?.access_token;

  const [pedidos, setPedidos] = useState<MiPedido[] | null>(null);
  const [error, setError] = useState('');
  const [abierto, setAbierto] = useState<number | null>(null);

  useEffect(() => {
    if (status === 'loading') return;
    if (status !== 'authenticated') {
      router.push('/login');
      return;
    }
    getMisPedidos(token as string)
      .then(setPedidos)
      .catch((err) => setError(err instanceof Error ? err.message : 'No se pudieron cargar tus pedidos'));
  }, [status, token, router]);

  const cargando = status === 'loading' || (pedidos === null && !error);

  if (cargando) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <p className="text-stone-400">Cargando...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50">
      <nav className="bg-white border-b border-stone-200 px-8 py-4">
        <button
          onClick={() => router.push('/')}
          className="flex items-center gap-2 text-stone-600 hover:text-cocoa-taupe transition-colors text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver a la tienda
        </button>
      </nav>

      <div className="max-w-2xl mx-auto px-6 py-12 flex flex-col gap-6">
        <h1 className="text-2xl font-serif text-stone-800">Mis pedidos</h1>

        {error && <p className="text-sm text-red-500">{error}</p>}

        {pedidos && pedidos.length === 0 && (
          <div className="bg-white border border-stone-200 rounded-2xl p-10 text-center text-stone-400">
            <Package className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">Todavía no hiciste ninguna compra.</p>
          </div>
        )}

        {pedidos && pedidos.length > 0 && (
          <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden">
            {pedidos.map((p) => {
              const estado = textoEstado(p);
              const pasos = pasosDe(p);
              const esAbierto = abierto === p.id_venta;
              return (
                <div key={p.id_venta} className="border-b border-stone-100 last:border-b-0">
                  <button
                    onClick={() => setAbierto(esAbierto ? null : p.id_venta)}
                    className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-stone-50 transition-colors"
                  >
                    {esAbierto ? (
                      <ChevronDown className="w-4 h-4 text-stone-400 flex-shrink-0" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-stone-400 flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-stone-800">Pedido #{p.id_venta}</p>
                      <p className="text-xs text-stone-500">{fecha(p.fecha_compra)}</p>
                    </div>
                    <span className="text-sm font-medium text-stone-800">{dinero(p.total)}</span>
                    <span className={`text-xs rounded-full px-3 py-1 whitespace-nowrap ${estado.clase}`}>
                      {estado.texto}
                    </span>
                  </button>

                  {esAbierto && (
                    <div className="px-5 pb-5 pt-1 bg-stone-50/60 flex flex-col gap-5">
                      {pasos && (
                        <ol className="flex items-center gap-2 pt-3">
                          {pasos.etiquetas.map((etiqueta, i) => {
                            const hecho = i < pasos.cumplidos;
                            return (
                              <li key={etiqueta} className="flex items-center gap-2 flex-1 last:flex-none">
                                <span
                                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs flex-shrink-0 ${
                                    hecho ? 'bg-cocoa-taupe text-white' : 'bg-stone-200 text-stone-400'
                                  }`}
                                >
                                  {hecho ? <Check className="w-3.5 h-3.5" /> : i + 1}
                                </span>
                                <span className={`text-xs ${hecho ? 'text-stone-800' : 'text-stone-400'}`}>
                                  {etiqueta}
                                </span>
                                {i < pasos.etiquetas.length - 1 && (
                                  <span className={`h-px flex-1 ${i + 1 < pasos.cumplidos ? 'bg-cocoa-taupe' : 'bg-stone-200'}`} />
                                )}
                              </li>
                            );
                          })}
                        </ol>
                      )}

                      {p.estado_envio === 'despachado' && (p.transportista || p.numero_seguimiento) && (
                        <div className="text-sm text-stone-700 bg-white border border-stone-200 rounded-xl p-3">
                          {p.transportista && <p>Transportista: <span className="font-medium">{p.transportista}</span></p>}
                          {p.numero_seguimiento && (
                            <p>Número de seguimiento: <span className="font-medium">{p.numero_seguimiento}</span></p>
                          )}
                          {p.fecha_despacho && <p className="text-xs text-stone-400 mt-1">Despachado el {fecha(p.fecha_despacho)}</p>}
                        </div>
                      )}

                      {p.estado_envio === 'retiro_listo' && (
                        <p className="text-sm text-stone-700 bg-white border border-stone-200 rounded-xl p-3">
                          Tu pedido ya está listo. Pasá a retirarlo por el local; los horarios y la dirección te llegaron por mail.
                        </p>
                      )}

                      {p.estado_envio === 'entregado' && p.fecha_entrega && (
                        <p className="text-xs text-stone-500">Entregado el {fecha(p.fecha_entrega)}</p>
                      )}

                      <div>
                        <h3 className="text-xs uppercase tracking-wide text-stone-400 mb-2">Productos</h3>
                        <div className="flex flex-col gap-1">
                          {p.items.map((i) => (
                            <div key={i.id_detalle} className="flex justify-between text-sm text-stone-700 gap-3">
                              <span className="min-w-0 truncate">
                                {i.cantidad} × {i.producto}
                              </span>
                              <span>{dinero(i.subtotal)}</span>
                            </div>
                          ))}
                        </div>
                        <div className="border-t border-stone-200 mt-2 pt-2 text-sm text-stone-600 flex flex-col gap-0.5">
                          <div className="flex justify-between">
                            <span>Productos</span>
                            <span>{dinero(p.subtotal_productos)}</span>
                          </div>
                          {p.tipo_entrega && (
                            <div className="flex justify-between">
                              <span>Envío</span>
                              <span>{p.costo_envio > 0 ? dinero(p.costo_envio) : 'Gratis'}</span>
                            </div>
                          )}
                          <div className="flex justify-between font-medium text-stone-800">
                            <span>Total</span>
                            <span>{dinero(p.total)}</span>
                          </div>
                        </div>
                      </div>

                      {p.destino && (
                        <div>
                          <h3 className="text-xs uppercase tracking-wide text-stone-400 mb-1">
                            {p.tipo_entrega === 'retiro' ? 'Entrega' : 'Enviado a'}
                          </h3>
                          <p className="text-sm text-stone-700">{p.destino}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
