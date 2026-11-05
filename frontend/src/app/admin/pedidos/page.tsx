'use client';
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  getPedidos,
  getPedido,
  cambiarEstadoPedido,
  type EstadoEnvio,
  type Pedido,
  type PedidoDetalle,
} from '@/lib/admin-api';

const LIMITE = 20;

const FILTROS: { valor: string; etiqueta: string }[] = [
  { valor: 'pendiente_despacho', etiqueta: 'Pendientes' },
  { valor: 'despachado', etiqueta: 'Despachados' },
  { valor: 'retiro_listo', etiqueta: 'Listos para retirar' },
  { valor: 'entregado', etiqueta: 'Entregados' },
  { valor: '', etiqueta: 'Todos' },
];

const ESTILOS_ESTADO: Record<EstadoEnvio, { texto: string; clase: string }> = {
  pendiente_despacho: { texto: 'Pendiente', clase: 'bg-amber-100 text-amber-800' },
  despachado: { texto: 'Despachado', clase: 'bg-blue-100 text-blue-800' },
  retiro_listo: { texto: 'Listo para retirar', clase: 'bg-purple-100 text-purple-800' },
  entregado: { texto: 'Entregado', clase: 'bg-green-100 text-green-800' },
};

function dinero(n: number) {
  return `$${n.toLocaleString('es-AR')}`;
}

function fecha(iso: string | null) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });
}

type Resultado =
  | { clave: string; items: Pedido[]; total: number }
  | { clave: string; error: string };

type DetalleCargado =
  | { clave: string; detalle: PedidoDetalle }
  | { clave: string; error: string };

export default function AdminPedidosPage() {
  const { data: session } = useSession();
  const token = (session as { access_token?: string } | null)?.access_token;

  const [filtro, setFiltro] = useState('pendiente_despacho');
  const [pagina, setPagina] = useState(1);
  const [recarga, setRecarga] = useState(0);
  const [resultado, setResultado] = useState<Resultado | null>(null);

  const [abierto, setAbierto] = useState<number | null>(null);
  const [detalleCargado, setDetalleCargado] = useState<DetalleCargado | null>(null);

  const claveLista = `${filtro}|${pagina}|${recarga}`;
  const claveDetalle = `${abierto}|${recarga}`;

  useEffect(() => {
    if (!token) return;
    let activo = true;
    getPedidos(token, { estado_envio: filtro || undefined, pagina, limite: LIMITE })
      .then((r) => activo && setResultado({ clave: claveLista, items: r.items, total: r.total }))
      .catch(
        (err) =>
          activo &&
          setResultado({
            clave: claveLista,
            error: err instanceof Error ? err.message : 'No se pudieron cargar los pedidos',
          }),
      );
    return () => {
      activo = false;
    };
  }, [token, filtro, pagina, claveLista]);

  useEffect(() => {
    if (!token || abierto === null) return;
    let activo = true;
    getPedido(token, abierto)
      .then((d) => activo && setDetalleCargado({ clave: claveDetalle, detalle: d }))
      .catch(
        (err) =>
          activo &&
          setDetalleCargado({
            clave: claveDetalle,
            error: err instanceof Error ? err.message : 'No se pudo cargar el pedido',
          }),
      );
    return () => {
      activo = false;
    };
  }, [token, abierto, claveDetalle]);

  const cargandoLista = !resultado || resultado.clave !== claveLista;
  const lista = resultado && resultado.clave === claveLista ? resultado : null;
  const detalleActual = detalleCargado && detalleCargado.clave === claveDetalle ? detalleCargado : null;

  function elegirFiltro(valor: string) {
    setFiltro(valor);
    setPagina(1);
    setAbierto(null);
  }

  async function cambiarEstado(
    id: number,
    dto: { estado_envio: EstadoEnvio; transportista?: string; numero_seguimiento?: string },
  ) {
    if (!token) throw new Error('Sesión no válida');
    await cambiarEstadoPedido(token, id, dto);
    setRecarga((n) => n + 1);
  }

  const totalPaginas = lista && 'total' in lista ? Math.max(1, Math.ceil(lista.total / LIMITE)) : 1;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-serif text-stone-800 mb-2">Pedidos</h1>
        <p className="text-sm text-stone-500">
          Pedidos pagados. Despachalos, cargá el seguimiento y el cliente recibe un mail con el aviso.
        </p>
      </div>

      <div className="flex gap-2 flex-wrap">
        {FILTROS.map((f) => (
          <button
            key={f.valor}
            onClick={() => elegirFiltro(f.valor)}
            className={`px-4 py-1.5 rounded-full text-sm border transition-colors ${
              filtro === f.valor
                ? 'bg-cocoa-taupe text-white border-cocoa-taupe'
                : 'bg-white text-stone-600 border-stone-200 hover:border-cocoa-taupe'
            }`}
          >
            {f.etiqueta}
          </button>
        ))}
      </div>

      {lista && 'error' in lista && <p className="text-sm text-red-500">{lista.error}</p>}
      {cargandoLista && <p className="text-stone-400 text-sm">Cargando...</p>}

      {lista && 'items' in lista && (
        <>
          {lista.items.length === 0 ? (
            <div className="bg-white border border-stone-200 rounded-2xl p-10 text-center text-stone-400 text-sm">
              No hay pedidos en esta sección.
            </div>
          ) : (
            <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden">
              {lista.items.map((p) => {
                const estilo = ESTILOS_ESTADO[p.estado_envio];
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
                      <span className="font-medium text-stone-800 w-16 flex-shrink-0">#{p.id_venta}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-stone-800 truncate">{p.cliente ?? 'Cliente'}</p>
                        <p className="text-xs text-stone-500 truncate">
                          {p.tipo_entrega === 'retiro' ? 'Retiro en local' : p.destino}
                        </p>
                      </div>
                      <span className="text-xs text-stone-400 hidden md:block">{fecha(p.fecha_compra)}</span>
                      <span className="text-sm font-medium text-stone-800 w-24 text-right">{dinero(p.total)}</span>
                      <span className={`text-xs rounded-full px-3 py-1 whitespace-nowrap ${estilo.clase}`}>
                        {estilo.texto}
                      </span>
                    </button>

                    {esAbierto && (
                      <div className="px-5 pb-5 pt-1 bg-stone-50/60">
                        {!detalleActual && <p className="text-sm text-stone-400">Cargando pedido...</p>}
                        {detalleActual && 'error' in detalleActual && (
                          <p className="text-sm text-red-500">{detalleActual.error}</p>
                        )}
                        {detalleActual && 'detalle' in detalleActual && (
                          <DetallePedido
                            key={`${detalleActual.detalle.id_venta}-${detalleActual.detalle.estado_envio}`}
                            pedido={detalleActual.detalle}
                            onCambiar={(dto) => cambiarEstado(p.id_venta, dto)}
                          />
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {totalPaginas > 1 && (
            <div className="flex items-center justify-center gap-4 text-sm text-stone-600">
              <Button
                variant="outline"
                className="rounded-full"
                disabled={pagina <= 1}
                onClick={() => {
                  setPagina((n) => n - 1);
                  setAbierto(null);
                }}
              >
                Anterior
              </Button>
              <span>
                Página {pagina} de {totalPaginas}
              </span>
              <Button
                variant="outline"
                className="rounded-full"
                disabled={pagina >= totalPaginas}
                onClick={() => {
                  setPagina((n) => n + 1);
                  setAbierto(null);
                }}
              >
                Siguiente
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function DetallePedido({
  pedido,
  onCambiar,
}: {
  pedido: PedidoDetalle;
  onCambiar: (dto: { estado_envio: EstadoEnvio; transportista?: string; numero_seguimiento?: string }) => Promise<void>;
}) {
  const [transportista, setTransportista] = useState(pedido.transportista ?? '');
  const [seguimiento, setSeguimiento] = useState(pedido.numero_seguimiento ?? '');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');

  async function ejecutar(dto: { estado_envio: EstadoEnvio; transportista?: string; numero_seguimiento?: string }) {
    setEnviando(true);
    setError('');
    try {
      await onCambiar(dto);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar el pedido');
    }
    setEnviando(false);
  }

  const dir = pedido.direccion;
  const esDomicilio = pedido.tipo_entrega === 'domicilio';
  const cambioSeguimiento =
    transportista.trim() !== (pedido.transportista ?? '') || seguimiento.trim() !== (pedido.numero_seguimiento ?? '');

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-3">
      <div className="flex flex-col gap-4">
        <div>
          <h3 className="text-xs uppercase tracking-wide text-stone-400 mb-2">Productos</h3>
          <div className="flex flex-col gap-1">
            {pedido.items.map((i) => (
              <div key={i.id_detalle} className="flex justify-between text-sm text-stone-700 gap-3">
                <span className="min-w-0 truncate">
                  {i.cantidad} × {i.producto} <span className="text-stone-400">({i.sku})</span>
                </span>
                <span>{dinero(i.subtotal)}</span>
              </div>
            ))}
          </div>
          <div className="border-t border-stone-200 mt-2 pt-2 text-sm text-stone-600 flex flex-col gap-0.5">
            <div className="flex justify-between">
              <span>Productos</span>
              <span>{dinero(pedido.subtotal_productos)}</span>
            </div>
            <div className="flex justify-between">
              <span>Envío</span>
              <span>{pedido.costo_envio > 0 ? dinero(pedido.costo_envio) : 'Gratis'}</span>
            </div>
            <div className="flex justify-between font-medium text-stone-800">
              <span>Total cobrado</span>
              <span>{dinero(pedido.total)}</span>
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-xs uppercase tracking-wide text-stone-400 mb-2">
            {esDomicilio ? 'Enviar a' : 'Retiro en local'}
          </h3>
          {esDomicilio && dir ? (
            <div className="text-sm text-stone-700">
              <p className="font-medium">{dir.destinatario}</p>
              <p>
                {dir.calle} {dir.numero}
                {dir.piso_depto ? `, ${dir.piso_depto}` : ''}
              </p>
              <p>
                {dir.localidad}, {dir.provincia} ({dir.codigo_postal})
              </p>
              <p className="text-stone-500">Tel: {dir.telefono}</p>
              {dir.observaciones && <p className="text-stone-500">{dir.observaciones}</p>}
            </div>
          ) : (
            <p className="text-sm text-stone-700">
              El cliente retira el pedido. Contacto: {pedido.cliente} ({pedido.email})
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <h3 className="text-xs uppercase tracking-wide text-stone-400">Estado del envío</h3>

        {(pedido.fecha_despacho || pedido.fecha_entrega) && (
          <div className="text-xs text-stone-500 flex flex-col gap-0.5">
            {pedido.fecha_despacho && (
              <span>
                {esDomicilio ? 'Despachado' : 'Listo para retirar'}: {fecha(pedido.fecha_despacho)}
              </span>
            )}
            {pedido.fecha_entrega && <span>Entregado: {fecha(pedido.fecha_entrega)}</span>}
          </div>
        )}

        {esDomicilio && pedido.estado_envio !== 'entregado' && (
          <div className="flex flex-col gap-2">
            <Input
              placeholder="Transportista (ej: Correo Argentino)"
              value={transportista}
              maxLength={60}
              onChange={(e) => setTransportista(e.target.value)}
            />
            <Input
              placeholder="Número de seguimiento (opcional)"
              value={seguimiento}
              maxLength={80}
              onChange={(e) => setSeguimiento(e.target.value)}
            />
          </div>
        )}

        {esDomicilio && pedido.estado_envio === 'entregado' && pedido.transportista && (
          <p className="text-sm text-stone-600">
            {pedido.transportista}
            {pedido.numero_seguimiento ? ` · ${pedido.numero_seguimiento}` : ''}
          </p>
        )}

        {error && <p className="text-sm text-red-500">{error}</p>}

        <div className="flex gap-2 flex-wrap">
          {pedido.estado_envio === 'pendiente_despacho' && esDomicilio && (
            <Button
              disabled={enviando || !transportista.trim()}
              onClick={() =>
                ejecutar({
                  estado_envio: 'despachado',
                  transportista: transportista.trim(),
                  numero_seguimiento: seguimiento.trim(),
                })
              }
              className="bg-cocoa-taupe hover:bg-espresso-brown text-white rounded-full"
            >
              {enviando ? 'Guardando...' : 'Marcar como despachado'}
            </Button>
          )}

          {pedido.estado_envio === 'pendiente_despacho' && !esDomicilio && (
            <Button
              disabled={enviando}
              onClick={() => ejecutar({ estado_envio: 'retiro_listo' })}
              className="bg-cocoa-taupe hover:bg-espresso-brown text-white rounded-full"
            >
              {enviando ? 'Guardando...' : 'Marcar listo para retirar'}
            </Button>
          )}

          {pedido.estado_envio === 'despachado' && (
            <Button
              variant="outline"
              disabled={enviando || !cambioSeguimiento || !transportista.trim()}
              onClick={() =>
                ejecutar({
                  estado_envio: 'despachado',
                  transportista: transportista.trim(),
                  numero_seguimiento: seguimiento.trim(),
                })
              }
              className="rounded-full"
            >
              Guardar cambios de seguimiento
            </Button>
          )}

          {(pedido.estado_envio === 'despachado' || pedido.estado_envio === 'retiro_listo') && (
            <Button
              disabled={enviando}
              onClick={() => ejecutar({ estado_envio: 'entregado' })}
              className="bg-green-700 hover:bg-green-800 text-white rounded-full"
            >
              Marcar como entregado
            </Button>
          )}
        </div>

        {pedido.estado_envio === 'pendiente_despacho' && (
          <p className="text-xs text-stone-400">Al despachar, el cliente recibe un mail con el seguimiento.</p>
        )}
      </div>
    </div>
  );
}
