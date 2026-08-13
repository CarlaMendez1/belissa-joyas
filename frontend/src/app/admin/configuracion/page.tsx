'use client';
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { getConfiguracion, actualizarConfiguracion } from '@/lib/admin-api';
import { Pencil, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

// Claves que representan un tiempo en minutos, y por eso se editan como horas + minutos
const CLAVES_TIEMPO = ['tiempo_abandono_carrito_minutos'];

const NOMBRES_AMIGABLES: Record<string, string> = {
  tiempo_abandono_carrito_minutos: 'Tiempo de inactividad para considerar un carrito abandonado',
};

function nombreAmigable(clave: string) {
  return NOMBRES_AMIGABLES[clave] || clave;
}

export default function AdminConfiguracionPage() {
  const { data: session } = useSession();
  const token = (session as any)?.access_token;

  const [configs, setConfigs] = useState<any[]>([]);
  const [cargando, setCargando] = useState(true);

  const [editando, setEditando] = useState<string | null>(null);
  const [valorEditado, setValorEditado] = useState('');
  const [horas, setHoras] = useState('0');
  const [mins, setMins] = useState('0');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  async function cargar() {
    setCargando(true);
    const data = await getConfiguracion(token);
    setConfigs(data);
    setCargando(false);
  }

  useEffect(() => {
    if (token) cargar();
  }, [token]);

  function esTiempo(clave: string) {
    return CLAVES_TIEMPO.includes(clave);
  }

  function abrirEditar(config: any) {
    setEditando(config.clave);
    setError('');
    if (esTiempo(config.clave)) {
      const totalMin = Number(config.valor) || 0;
      setHoras(String(Math.floor(totalMin / 60)));
      setMins(String(totalMin % 60));
    } else {
      setValorEditado(config.valor);
    }
  }

  async function handleGuardar(clave: string) {
    let nuevoValor: string;

    if (esTiempo(clave)) {
      const h = Number(horas);
      const m = Number(mins);
      if (!Number.isInteger(h) || !Number.isInteger(m) || h < 0 || m < 0 || m > 59) {
        setError('Ingresá horas y minutos válidos (minutos entre 0 y 59)');
        return;
      }
      const totalMin = h * 60 + m;
      if (totalMin <= 0) {
        setError('El tiempo total debe ser mayor a 0');
        return;
      }
      nuevoValor = String(totalMin);
    } else {
      if (!valorEditado.trim()) {
        setError('El valor no puede estar vacío');
        return;
      }
      nuevoValor = valorEditado;
    }

    setGuardando(true);
    setError('');
    try {
      await actualizarConfiguracion(token, clave, nuevoValor);
      await cargar();
      setEditando(null);
    } catch (err: any) {
      setError(err.message || 'Error al guardar');
    }
    setGuardando(false);
  }

  function formatearValor(config: any) {
    if (esTiempo(config.clave)) {
      const totalMin = Number(config.valor) || 0;
      const h = Math.floor(totalMin / 60);
      const m = totalMin % 60;
      if (h === 0) return `${m} min`;
      if (m === 0) return `${h} h`;
      return `${h} h ${m} min`;
    }
    return config.valor;
  }

  return (
    <div>
      <h1 className="text-2xl font-serif text-stone-800 mb-2">Configuración</h1>
      <p className="text-sm text-stone-500 mb-6">
        Parámetros generales del sistema, como los tiempos usados para procesos automáticos.
      </p>

      {cargando ? (
        <p className="text-stone-400">Cargando...</p>
      ) : configs.length === 0 ? (
        <p className="text-stone-400">No hay configuraciones cargadas.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {configs.map((config: any) => (
            <div key={config.clave} className="bg-white border border-stone-200 rounded-xl p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1">
                  <p className="text-sm font-medium text-stone-800">{nombreAmigable(config.clave)}</p>
                  {config.descripcion && (
                    <p className="text-xs text-stone-500 mt-0.5">{config.descripcion}</p>
                  )}
                </div>

                {editando === config.clave ? (
                  esTiempo(config.clave) ? (
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          min={0}
                          value={horas}
                          onChange={(e) => setHoras(e.target.value)}
                          className="w-16 text-right"
                        />
                        <span className="text-xs text-stone-500">h</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          min={0}
                          max={59}
                          value={mins}
                          onChange={(e) => setMins(e.target.value)}
                          className="w-16 text-right"
                        />
                        <span className="text-xs text-stone-500">min</span>
                      </div>
                      <button
                        onClick={() => handleGuardar(config.clave)}
                        disabled={guardando}
                        className="text-green-600 hover:text-green-700"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setEditando(null)}
                        className="text-stone-400 hover:text-red-500"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Input
                        value={valorEditado}
                        onChange={(e) => setValorEditado(e.target.value)}
                        className="w-24 text-right"
                      />
                      <button
                        onClick={() => handleGuardar(config.clave)}
                        disabled={guardando}
                        className="text-green-600 hover:text-green-700"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setEditando(null)}
                        className="text-stone-400 hover:text-red-500"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )
                ) : (
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-semibold text-amber-700">{formatearValor(config)}</span>
                    <button onClick={() => abrirEditar(config)} className="text-stone-400 hover:text-amber-700">
                      <Pencil className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
              {editando === config.clave && error && (
                <p className="text-xs text-red-500 mt-2 text-right">{error}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}