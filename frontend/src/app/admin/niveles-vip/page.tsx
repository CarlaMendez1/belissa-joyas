'use client';
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { getNivelesVip } from '@/lib/api';
import { actualizarNivelVip } from '@/lib/admin-api';
import { Pencil, Check, X, Crown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function AdminNivelesVipPage() {
  const { data: session } = useSession();
  const token = (session as any)?.access_token;

  const [niveles, setNiveles] = useState<any[]>([]);
  const [cargando, setCargando] = useState(true);

  const [editando, setEditando] = useState<number | null>(null);
  const [monto, setMonto] = useState('');
  const [cantidad, setCantidad] = useState('');
  const [descuento, setDescuento] = useState('');
  const [beneficios, setBeneficios] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  async function cargar() {
    setCargando(true);
    const data = await getNivelesVip();
    setNiveles(data);
    setCargando(false);
  }

  useEffect(() => {
    cargar();
  }, []);

  function abrirEditar(nivel: any) {
    setEditando(nivel.id_nivel_vip);
    setMonto(String(nivel.monto_min_requerido));
    setCantidad(String(nivel.cantidad_compras_min_requerida));
    setDescuento(String(nivel.porcentaje_descuento));
    setBeneficios(nivel.beneficios || '');
    setError('');
  }

  async function handleGuardar(id: number) {
    const montoNum = Number(monto);
    const cantidadNum = Number(cantidad);
    const descuentoNum = Number(descuento);

    if (montoNum < 0 || cantidadNum < 0 || descuentoNum < 0 || descuentoNum > 100) {
      setError('Verificá los valores: no pueden ser negativos y el descuento debe estar entre 0 y 100');
      return;
    }

    setGuardando(true);
    setError('');
    try {
      await actualizarNivelVip(token, id, {
        monto_min_requerido: montoNum,
        cantidad_compras_min_requerida: cantidadNum,
        porcentaje_descuento: descuentoNum,
        beneficios,
      });
      await cargar();
      setEditando(null);
    } catch (err: any) {
      setError(err.message || 'Error al guardar');
    }
    setGuardando(false);
  }

  const coloresPorNivel: Record<string, string> = {
    Bronce: 'text-amber-700 bg-amber-50 border-amber-200',
    Plata: 'text-stone-500 bg-stone-50 border-stone-300',
    Oro: 'text-yellow-600 bg-yellow-50 border-yellow-300',
  };

  return (
    <div>
      <h1 className="text-2xl font-serif text-stone-800 mb-2">Niveles VIP</h1>
      <p className="text-sm text-stone-500 mb-6">
        Definí los umbrales y beneficios de cada nivel de fidelidad. El nivel se recalcula
        automáticamente considerando las compras confirmadas de los últimos 12 meses.
      </p>

      {cargando ? (
        <p className="text-stone-400">Cargando...</p>
      ) : (
        <div className="flex flex-col gap-4">
          {niveles.map((nivel: any) => (
            <div
              key={nivel.id_nivel_vip}
              className={`border rounded-xl p-5 ${coloresPorNivel[nivel.nombre_nivel] || 'bg-white border-stone-200'}`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Crown className="w-5 h-5" />
                  <h2 className="font-serif text-lg">{nivel.nombre_nivel}</h2>
                </div>
                {editando !== nivel.id_nivel_vip && (
                  <button onClick={() => abrirEditar(nivel)} className="hover:opacity-70">
                    <Pencil className="w-4 h-4" />
                  </button>
                )}
              </div>

              {editando === nivel.id_nivel_vip ? (
                <div className="flex flex-col gap-3 bg-white rounded-lg p-4 border border-stone-200">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-stone-600 mb-1 block">Monto mínimo ($)</label>
                      <Input type="number" min={0} value={monto} onChange={(e) => setMonto(e.target.value)} />
                    </div>
                    <div>
                      <label className="text-xs text-stone-600 mb-1 block">Compras mínimas</label>
                      <Input type="number" min={0} value={cantidad} onChange={(e) => setCantidad(e.target.value)} />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-stone-600 mb-1 block">Descuento (%)</label>
                    <Input type="number" min={0} max={100} value={descuento} onChange={(e) => setDescuento(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs text-stone-600 mb-1 block">Beneficios (texto libre)</label>
                    <Input value={beneficios} onChange={(e) => setBeneficios(e.target.value)} />
                  </div>
                  {error && <p className="text-xs text-red-500">{error}</p>}
                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleGuardar(nivel.id_nivel_vip)}
                      disabled={guardando}
                      size="sm"
                      className="bg-amber-700 hover:bg-amber-800 text-white rounded-full flex items-center gap-1"
                    >
                      <Check className="w-3.5 h-3.5" />
                      Guardar
                    </Button>
                    <Button onClick={() => setEditando(null)} size="sm" variant="outline" className="rounded-full flex items-center gap-1">
                      <X className="w-3.5 h-3.5" />
                      Cancelar
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-sm space-y-1">
                  <p>
                    Requiere: <strong>${Number(nivel.monto_min_requerido).toLocaleString('es-AR')}</strong> acumulados
                    {nivel.cantidad_compras_min_requerida > 0 && (
                      <> y <strong>{nivel.cantidad_compras_min_requerida}</strong> compras mínimas</>
                    )}
                    {' '}(últimos 12 meses)
                  </p>
                  <p>Descuento: <strong>{nivel.porcentaje_descuento}%</strong></p>
                  {nivel.beneficios && <p className="opacity-80">{nivel.beneficios}</p>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}