'use client';
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { getMiNivelVip } from '@/lib/api';
import { Crown, ArrowLeft, Sparkles } from 'lucide-react';

const COLORES_NIVEL: Record<string, { bg: string; texto: string; borde: string }> = {
  Bronce: { bg: 'bg-amber-100', texto: 'text-amber-800', borde: 'border-amber-300' },
  Plata: { bg: 'bg-stone-200', texto: 'text-stone-700', borde: 'border-stone-400' },
  Oro: { bg: 'bg-yellow-100', texto: 'text-yellow-800', borde: 'border-yellow-400' },
};

type NivelVip = {
  nombre_nivel: string;
  porcentaje_descuento: number;
  beneficios?: string;
};

type ProgresoVip = {
  falta_monto: number;
  falta_compras: number;
};

type DatosNivelVip = {
  nivel_actual?: NivelVip;
  proximo_nivel?: NivelVip;
  progreso?: ProgresoVip;
};

export default function MiCuentaPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const token = (session as { access_token?: string } | null)?.access_token;

  const [datos, setDatos] = useState<DatosNivelVip | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (status === 'loading') return;
    if (status !== 'authenticated') {
      router.push('/login');
      return;
    }

    getMiNivelVip(token)
      .then(setDatos)
      .catch((err) => setError(err.message || 'No se pudo cargar tu información'))
      .finally(() => setCargando(false));
  }, [status, token]);

  if (status === 'loading' || cargando) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <p className="text-stone-400">Cargando...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <p className="text-red-500">{error}</p>
      </div>
    );
  }

  const nivel = datos?.nivel_actual;
  const proximo = datos?.proximo_nivel;
  const progreso = datos?.progreso;
  const colores = COLORES_NIVEL[nivel?.nombre_nivel] || COLORES_NIVEL.Bronce;

  // Porcentaje de avance hacia el próximo nivel, tomando el criterio
  // que esté más cerca de cumplirse (monto o cantidad de compras),
  // para que la barra visual sea representativa aunque falten ambos.
  let porcentajeAvance = 100;
if (proximo && progreso) {
  const criterios: number[] = [];

  if (Number(proximo.monto_min_requerido) > 0) {
    criterios.push(1 - progreso.falta_monto / Number(proximo.monto_min_requerido));
  }
  if (proximo.cantidad_compras_min_requerida > 0) {
    criterios.push(1 - progreso.falta_compras / proximo.cantidad_compras_min_requerida);
  }

  const avance = criterios.length > 0 ? Math.min(...criterios) : 1;
  porcentajeAvance = Math.max(0, Math.min(100, avance * 100));
}

  return (
    <div className="min-h-screen bg-stone-50">
      <nav className="bg-white border-b border-stone-200 px-8 py-4">
        <button
          onClick={() => router.push('/')}
          className="flex items-center gap-2 text-stone-600 hover:text-amber-700 transition-colors text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver a la tienda
        </button>
      </nav>

      <div className="max-w-2xl mx-auto px-6 py-12">
        <h1 className="text-2xl font-serif text-stone-800 mb-8">Mi nivel de fidelidad</h1>

        {/* Card de nivel actual */}
        <div className={`rounded-2xl border-2 ${colores.borde} ${colores.bg} p-8 mb-8`}>
          <div className="flex items-center gap-3 mb-2">
            <Crown className={`w-8 h-8 ${colores.texto}`} />
            <div>
              <p className="text-xs uppercase tracking-wide text-stone-500">Tu nivel actual</p>
              <h2 className={`text-2xl font-serif font-semibold ${colores.texto}`}>
                {nivel?.nombre_nivel}
              </h2>
            </div>
          </div>
          <p className="text-sm text-stone-600 mt-4">
            Tenés un <span className="font-semibold">{Number(nivel?.porcentaje_descuento)}% de descuento</span> en todas tus compras.
          </p>
          {nivel?.beneficios && (
            <p className="text-sm text-stone-500 mt-2">{nivel.beneficios}</p>
          )}
        </div>

        {/* Progreso hacia el próximo nivel */}
        {proximo ? (
          <div className="bg-white border border-stone-200 rounded-2xl p-8">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-5 h-5 text-amber-700" />
              <h3 className="font-serif text-lg text-stone-800">
                Camino a {proximo.nombre_nivel}
              </h3>
            </div>

            <div className="w-full bg-stone-100 rounded-full h-3 mb-6 overflow-hidden">
              <div
                className="bg-amber-700 h-full rounded-full transition-all"
                style={{ width: `${porcentajeAvance}%` }}
              />
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div>
                <p className="text-xs text-stone-500 mb-1">Te falta gastar</p>
                <p className="text-lg font-semibold text-stone-800">
                  {progreso.falta_monto > 0
                    ? `$${progreso.falta_monto.toLocaleString('es-AR')}`
                    : '¡Listo!'}
                </p>
              </div>
              <div>
                <p className="text-xs text-stone-500 mb-1">Te faltan comprar</p>
                <p className="text-lg font-semibold text-stone-800">
                  {progreso.falta_compras > 0
                    ? `${progreso.falta_compras} ${progreso.falta_compras === 1 ? 'compra' : 'compras'}`
                    : '¡Listo!'}
                </p>
              </div>
            </div>

            <p className="text-xs text-stone-400 mt-6">
              Estas métricas consideran tus compras confirmadas de los últimos 12 meses.
            </p>
          </div>
        ) : (
          <div className="bg-white border border-stone-200 rounded-2xl p-8 text-center">
            <Crown className="w-10 h-10 text-amber-700 mx-auto mb-3" />
            <p className="text-stone-700 font-medium">
              ¡Ya alcanzaste nuestro nivel máximo!
            </p>
            <p className="text-sm text-stone-500 mt-2">
              Gracias por ser una clienta tan fiel de Belissa Joyas.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}