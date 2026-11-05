'use client';
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  getConfiguracion,
  actualizarConfiguracion,
  getTarifasEnvio,
  actualizarTarifaEnvio,
  type TarifaEnvio,
} from '@/lib/admin-api';

type Config = { clave: string; valor: string; descripcion?: string };

const CLAVES_ENVIO = ['envio_precio_base', 'envio_gratis_desde', 'retiro_local_activo', 'retiro_local_direccion'];

const TITULOS: Record<string, { titulo: string; ayuda: string }> = {
  envio_precio_base: {
    titulo: 'Precio base de envío ($)',
    ayuda: 'Se usa para las provincias que no tienen una tarifa activa.',
  },
  envio_gratis_desde: {
    titulo: 'Envío gratis desde ($)',
    ayuda: 'Monto de productos (ya con el descuento VIP) desde el cual el envío es gratis. 0 = desactivado.',
  },
  retiro_local_activo: {
    titulo: 'Permitir retiro en local',
    ayuda: 'Si está activo, el cliente puede elegir retirar sin costo.',
  },
  retiro_local_direccion: {
    titulo: 'Dirección y horarios del local',
    ayuda: 'Es lo que ve el cliente al elegir retiro en local.',
  },
};

type Fila = { precio: string; plazo: string; activa: boolean };

export default function AdminEnviosPage() {
  const { data: session } = useSession();
  const token = (session as { access_token?: string } | null)?.access_token;

  const [configs, setConfigs] = useState<Record<string, string>>({});
  const [editadas, setEditadas] = useState<Record<string, string>>({});
  const [errorConfig, setErrorConfig] = useState('');
  const [guardandoClave, setGuardandoClave] = useState<string | null>(null);

  const [tarifas, setTarifas] = useState<TarifaEnvio[]>([]);
  const [filas, setFilas] = useState<Record<number, Fila>>({});
  const [errorTarifa, setErrorTarifa] = useState<Record<number, string>>({});
  const [guardandoTarifa, setGuardandoTarifa] = useState<number | null>(null);
  const [cargando, setCargando] = useState(true);

  function aFila(t: TarifaEnvio): Fila {
    return { precio: String(Number(t.precio)), plazo: t.plazo_dias ? String(t.plazo_dias) : '', activa: t.activa };
  }

  useEffect(() => {
    if (!token) return;
    Promise.all([getConfiguracion(token), getTarifasEnvio(token)])
      .then(([cfgs, tars]: [Config[], TarifaEnvio[]]) => {
        const mapa: Record<string, string> = {};
        cfgs.filter((c) => CLAVES_ENVIO.includes(c.clave)).forEach((c) => (mapa[c.clave] = c.valor));
        setConfigs(mapa);
        setEditadas(mapa);
        setTarifas(tars);
        setFilas(Object.fromEntries(tars.map((t) => [t.id_tarifa, aFila(t)])));
      })
      .catch((err) => setErrorConfig(err instanceof Error ? err.message : 'No se pudo cargar'))
      .finally(() => setCargando(false));
  }, [token]);

  async function guardarConfig(clave: string) {
    if (!token) return;
    const valor = (editadas[clave] ?? '').trim();
    if (!valor) {
      setErrorConfig('El valor no puede estar vacío');
      return;
    }
    if ((clave === 'envio_precio_base' || clave === 'envio_gratis_desde') && !(Number(valor) >= 0)) {
      setErrorConfig('Ingresá un monto válido (0 o más)');
      return;
    }
    setGuardandoClave(clave);
    setErrorConfig('');
    try {
      await actualizarConfiguracion(token, clave, valor);
      setConfigs((c) => ({ ...c, [clave]: valor }));
      setEditadas((c) => ({ ...c, [clave]: valor }));
    } catch (err) {
      setErrorConfig(err instanceof Error ? err.message : 'No se pudo guardar');
    }
    setGuardandoClave(null);
  }

  function cambiarFila(id: number, cambios: Partial<Fila>) {
    setFilas((f) => ({ ...f, [id]: { ...f[id], ...cambios } }));
  }

  async function guardarTarifa(t: TarifaEnvio) {
    if (!token) return;
    const f = filas[t.id_tarifa];
    const precio = Number(f.precio);
    const plazo = f.plazo.trim() === '' ? null : Number(f.plazo);

    if (f.precio.trim() === '' || !(precio >= 0)) {
      setErrorTarifa((e) => ({ ...e, [t.id_tarifa]: 'Precio inválido' }));
      return;
    }
    if (plazo !== null && (!Number.isInteger(plazo) || plazo < 1 || plazo > 60)) {
      setErrorTarifa((e) => ({ ...e, [t.id_tarifa]: 'El plazo va de 1 a 60 días' }));
      return;
    }

    setGuardandoTarifa(t.id_tarifa);
    setErrorTarifa((e) => ({ ...e, [t.id_tarifa]: '' }));
    try {
      const actualizada = await actualizarTarifaEnvio(token, t.id_tarifa, {
        precio,
        plazo_dias: plazo,
        activa: f.activa,
      });
      setTarifas((ts) => ts.map((x) => (x.id_tarifa === t.id_tarifa ? actualizada : x)));
      setFilas((fs) => ({ ...fs, [t.id_tarifa]: aFila(actualizada) }));
    } catch (err) {
      setErrorTarifa((e) => ({
        ...e,
        [t.id_tarifa]: err instanceof Error ? err.message : 'No se pudo guardar',
      }));
    }
    setGuardandoTarifa(null);
  }

  if (cargando) return <p className="text-stone-400">Cargando...</p>;

  return (
    <div className="flex flex-col gap-10">
      <div>
        <h1 className="text-2xl font-serif text-stone-800 mb-2">Envíos</h1>
        <p className="text-sm text-stone-500">
          Definí cuánto cobrás de envío por provincia y las opciones de entrega que ve el cliente al comprar.
        </p>
      </div>

      {/* Parámetros */}
      <section>
        <h2 className="font-serif text-lg text-stone-800 mb-3">Opciones de entrega</h2>
        {errorConfig && <p className="text-sm text-red-500 mb-3">{errorConfig}</p>}
        <div className="flex flex-col gap-3">
          {CLAVES_ENVIO.map((clave) => {
            if (!(clave in configs)) return null;
            const info = TITULOS[clave];
            const cambio = (editadas[clave] ?? '') !== configs[clave];
            return (
              <div key={clave} className="bg-white border border-stone-200 rounded-xl p-4 flex items-center gap-4">
                <div className="flex-1">
                  <p className="text-sm font-medium text-stone-800">{info.titulo}</p>
                  <p className="text-xs text-stone-500 mt-0.5">{info.ayuda}</p>
                </div>

                {clave === 'retiro_local_activo' ? (
                  <label className="flex items-center gap-2 text-sm text-stone-600">
                    <input
                      type="checkbox"
                      checked={(editadas[clave] ?? '').toLowerCase() === 'true'}
                      onChange={(e) => setEditadas((c) => ({ ...c, [clave]: e.target.checked ? 'true' : 'false' }))}
                    />
                    {(editadas[clave] ?? '').toLowerCase() === 'true' ? 'Activo' : 'Desactivado'}
                  </label>
                ) : (
                  <Input
                    value={editadas[clave] ?? ''}
                    maxLength={255}
                    onChange={(e) => setEditadas((c) => ({ ...c, [clave]: e.target.value }))}
                    className={clave === 'retiro_local_direccion' ? 'w-72' : 'w-32 text-right'}
                  />
                )}

                <Button
                  onClick={() => guardarConfig(clave)}
                  disabled={!cambio || guardandoClave === clave}
                  className="bg-cocoa-taupe hover:bg-espresso-brown text-white rounded-full"
                >
                  {guardandoClave === clave ? '...' : 'Guardar'}
                </Button>
              </div>
            );
          })}
        </div>
      </section>

      {/* Tarifas */}
      <section>
        <h2 className="font-serif text-lg text-stone-800 mb-1">Tarifas por provincia</h2>
        <p className="text-xs text-stone-500 mb-3">
          Una provincia desactivada usa el precio base. El plazo es opcional (días estimados de entrega).
        </p>
        <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 text-stone-500 text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-2 font-medium">Provincia</th>
                <th className="text-right px-4 py-2 font-medium">Precio ($)</th>
                <th className="text-right px-4 py-2 font-medium">Plazo (días)</th>
                <th className="text-center px-4 py-2 font-medium">Activa</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {tarifas.map((t) => {
                const f = filas[t.id_tarifa];
                if (!f) return null;
                const original = aFila(t);
                const cambio =
                  f.precio !== original.precio || f.plazo !== original.plazo || f.activa !== original.activa;
                return (
                  <tr key={t.id_tarifa} className="border-t border-stone-100 align-top">
                    <td className="px-4 py-2 text-stone-800">
                      {t.provincia.nombre}
                      {errorTarifa[t.id_tarifa] && (
                        <p className="text-xs text-red-500 mt-1">{errorTarifa[t.id_tarifa]}</p>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={f.precio}
                        onChange={(e) => cambiarFila(t.id_tarifa, { precio: e.target.value })}
                        className="w-28 ml-auto text-right"
                      />
                    </td>
                    <td className="px-4 py-2 text-right">
                      <Input
                        type="number"
                        min={1}
                        max={60}
                        value={f.plazo}
                        onChange={(e) => cambiarFila(t.id_tarifa, { plazo: e.target.value })}
                        className="w-20 ml-auto text-right"
                      />
                    </td>
                    <td className="px-4 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={f.activa}
                        onChange={(e) => cambiarFila(t.id_tarifa, { activa: e.target.checked })}
                      />
                    </td>
                    <td className="px-4 py-2 text-right">
                      <button
                        onClick={() => guardarTarifa(t)}
                        disabled={!cambio || guardandoTarifa === t.id_tarifa}
                        title="Guardar"
                        className="text-green-600 hover:text-green-700 disabled:text-stone-300"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}