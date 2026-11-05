'use client';
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import {
  getAuditoria, getEntidadesAuditoria,
  type RegistroAuditoria, type RespuestaAuditoria,
} from '@/lib/admin-api';
import { ChevronDown, ChevronRight, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { nombreEntidad, detalleDe, tituloRegistro } from '@/lib/auditoria-utils';

const LIMITE = 20;

const ACCIONES: Record<string, { texto: string; clase: string }> = {
  crear: { texto: 'Creó', clase: 'bg-blush-oat/60 text-espresso-brown' },
  editar: { texto: 'Editó', clase: 'bg-stone-100 text-stone-700' },
  eliminar: { texto: 'Eliminó', clase: 'bg-red-50 text-red-700' },
};

function formatoFecha(iso: string) {
  return new Date(iso).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });
}

function formatoValor(valor: unknown): string {
  if (valor === null || valor === undefined || valor === '') return '—';
  if (typeof valor === 'object') return JSON.stringify(valor);
  return String(valor);
}

// Lista de cambios: campo, valor anterior y valor nuevo.
function Detalle({ registro }: { registro: RegistroAuditoria }) {
  const antes = registro.datos_anteriores ?? {};
  const despues = registro.datos_nuevos ?? {};
  const campos = Array.from(new Set([...Object.keys(antes), ...Object.keys(despues)])).filter(
    (c) => !(['clave', 'provincia'].includes(c) && antes[c] === despues[c]),
  );
  if (campos.length === 0) {
    return <p className="text-xs text-stone-400">Sin detalle registrado.</p>;
  }

  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="text-left text-stone-500">
          <th className="py-1 pr-4 font-medium">Campo</th>
          <th className="py-1 pr-4 font-medium">Antes</th>
          <th className="py-1 font-medium">Después</th>
        </tr>
      </thead>
      <tbody>
        {campos.map((campo) => (
          <tr key={campo} className="border-t border-stone-200">
            <td className="py-1.5 pr-4 font-mono text-stone-600">{campo}</td>
            <td className="py-1.5 pr-4 text-stone-500 break-all">{formatoValor(antes[campo])}</td>
            <td className="py-1.5 text-espresso-brown break-all">{formatoValor(despues[campo])}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function AdminAuditoriaPage() {
  const { data: session } = useSession();
  const token = (session as any)?.access_token as string | undefined;

  const [respuesta, setRespuesta] = useState<RespuestaAuditoria | null>(null);
  const [entidades, setEntidades] = useState<string[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [abierto, setAbierto] = useState<number | null>(null);

  const [entidad, setEntidad] = useState('');
  const [accion, setAccion] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [pagina, setPagina] = useState(1);

  useEffect(() => {
    if (!token) return;
    getEntidadesAuditoria(token).then(setEntidades).catch(() => setEntidades([]));
  }, [token]);

  useEffect(() => {
    if (!token) return;
    setCargando(true);
    setError('');
    getAuditoria(token, { entidad, accion, desde, hasta, pagina, limite: LIMITE })
      .then((r) => {
        setRespuesta(r);
        setAbierto(null);
      })
      .catch((e) => setError(e.message || 'No se pudo cargar el historial'))
      .finally(() => setCargando(false));
  }, [token, entidad, accion, desde, hasta, pagina]);

  function cambiarFiltro(setter: (v: string) => void, valor: string) {
    setter(valor);
    setPagina(1);
  }

  function limpiar() {
    setEntidad('');
    setAccion('');
    setDesde('');
    setHasta('');
    setPagina(1);
  }

  const totalPaginas = respuesta ? Math.max(1, Math.ceil(respuesta.total / LIMITE)) : 1;
  const hayFiltros = !!(entidad || accion || desde || hasta);
  const claseCampo =
    'rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-700 focus:outline-none focus:border-dusty-rose';

  return (
    <div>
      <h1 className="text-2xl font-serif text-stone-800 mb-2">Auditoría</h1>
      <p className="text-sm text-stone-500 mb-6">
        Historial de cambios hechos por administradores: qué se creó, editó o eliminó, quién lo hizo y cuándo.
      </p>

      <div className="flex flex-wrap items-end gap-3 mb-6">
        <label className="text-xs text-stone-500">
          <span className="block mb-1">Qué</span>
          <select className={claseCampo} value={entidad} onChange={(e) => cambiarFiltro(setEntidad, e.target.value)}>
            <option value="">Todo</option>
            {entidades.map((e) => (
              <option key={e} value={e}>{nombreEntidad(e)}</option>
            ))}
          </select>
        </label>
        <label className="text-xs text-stone-500">
          <span className="block mb-1">Acción</span>
          <select className={claseCampo} value={accion} onChange={(e) => cambiarFiltro(setAccion, e.target.value)}>
            <option value="">Todas</option>
            <option value="crear">Creó</option>
            <option value="editar">Editó</option>
            <option value="eliminar">Eliminó</option>
          </select>
        </label>
        <label className="text-xs text-stone-500">
          <span className="block mb-1">Desde</span>
          <input type="date" className={claseCampo} value={desde} max={hasta || undefined}
            onChange={(e) => cambiarFiltro(setDesde, e.target.value)} />
        </label>
        <label className="text-xs text-stone-500">
          <span className="block mb-1">Hasta</span>
          <input type="date" className={claseCampo} value={hasta} min={desde || undefined}
            onChange={(e) => cambiarFiltro(setHasta, e.target.value)} />
        </label>
        {hayFiltros && (
          <Button onClick={limpiar} variant="outline" className="rounded-full">Limpiar filtros</Button>
        )}
      </div>

      {error && <p className="mb-4 text-sm text-red-500">{error}</p>}

      <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
        {cargando ? (
          <p className="p-4 text-sm text-stone-400">Cargando...</p>
        ) : !respuesta || respuesta.items.length === 0 ? (
          <p className="p-4 text-sm text-stone-400">
            {hayFiltros ? 'No hay registros con esos filtros.' : 'Todavía no hay actividad registrada.'}
          </p>
        ) : (
          <ul className="divide-y divide-stone-100">
            {respuesta.items.map((r) => {
              const accionInfo = ACCIONES[r.accion] ?? { texto: r.accion, clase: 'bg-stone-100 text-stone-700' };
              const expandido = abierto === r.id_log;
              return (
                <li key={r.id_log}>
                  <button
                    type="button"
                    onClick={() => setAbierto(expandido ? null : r.id_log)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-milk transition-colors"
                  >
                    {expandido
                      ? <ChevronDown className="w-4 h-4 text-stone-400 shrink-0" />
                      : <ChevronRight className="w-4 h-4 text-stone-400 shrink-0" />}
                    <span className={`text-xs rounded-full px-2 py-0.5 shrink-0 ${accionInfo.clase}`}>
                      {accionInfo.texto}
                    </span>
                    <span className="text-sm text-stone-800">
                     {tituloRegistro({ ...r, detalle: detalleDe(r.datos_anteriores, r.datos_nuevos) })}
                    </span>
                    <span className="ml-auto text-xs text-stone-500 text-right">
                      {r.usuario ?? 'Sistema'} · {formatoFecha(r.fecha)}
                    </span>
                  </button>
                  {expandido && (
                    <div className="bg-stone-50 px-4 py-3 border-t border-stone-100">
                      <Detalle registro={r} />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {respuesta && respuesta.total > LIMITE && (
        <div className="flex items-center justify-between mt-4 text-sm text-stone-500">
          <span>{respuesta.total} registros</span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="rounded-full" disabled={pagina <= 1}
              onClick={() => setPagina(pagina - 1)}>
              <ChevronLeft className="w-4 h-4" /> Anterior
            </Button>
            <span>Página {pagina} de {totalPaginas}</span>
            <Button variant="outline" size="sm" className="rounded-full" disabled={pagina >= totalPaginas}
              onClick={() => setPagina(pagina + 1)}>
              Siguiente <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
