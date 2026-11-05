'use client';
import { useCallback, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, MapPin, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import FormularioDireccion from '@/components/formulario-direccion';
import {
  getProvincias,
  getMisDirecciones,
  crearDireccion,
  actualizarDireccion,
  type Direccion,
  type DireccionInput,
  type Provincia,
} from '@/lib/api';

export default function MiDireccionPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const token = (session as { access_token?: string } | null)?.access_token;

  const [provincias, setProvincias] = useState<Provincia[]>([]);
  const [direccion, setDireccion] = useState<Direccion | null>(null);
  const [cargando, setCargando] = useState(true);
  const [errorPagina, setErrorPagina] = useState('');

  const [editando, setEditando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [errorForm, setErrorForm] = useState('');

  const cargar = useCallback(async () => {
    if (!token) return;
    try {
      const [provs, dirs] = await Promise.all([getProvincias(), getMisDirecciones(token)]);
      setProvincias(provs);
      setDireccion(dirs[0] ?? null);
    } catch (err) {
      setErrorPagina(err instanceof Error ? err.message : 'No se pudo cargar tu dirección');
    } finally {
      setCargando(false);
    }
  }, [token]);

  useEffect(() => {
    if (status === 'loading') return;
    if (status !== 'authenticated') {
      router.push('/login');
      return;
    }
    // Carga inicial (las recargas posteriores las dispara cada acción con cargar())
    Promise.all([getProvincias(), getMisDirecciones(token as string)])
      .then(([provs, dirs]) => {
        setProvincias(provs);
        setDireccion(dirs[0] ?? null);
      })
      .catch((err) => setErrorPagina(err instanceof Error ? err.message : 'No se pudo cargar tu dirección'))
      .finally(() => setCargando(false));
  }, [status, token, router]);

  async function handleGuardar(dto: DireccionInput) {
    if (!token) return;
    setGuardando(true);
    setErrorForm('');
    try {
      if (direccion) {
        await actualizarDireccion(token, direccion.id_direccion, dto);
      } else {
        await crearDireccion(token, dto);
      }
      await cargar();
      setEditando(false);
    } catch (err) {
      setErrorForm(err instanceof Error ? err.message : 'No se pudo guardar la dirección');
    }
    setGuardando(false);
  }

  if (status === 'loading' || cargando) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <p className="text-stone-400">Cargando...</p>
      </div>
    );
  }

  const mostrarFormulario = editando || !direccion;

  return (
    <div className="min-h-screen bg-stone-50">
      <nav className="bg-white border-b border-stone-200 px-8 py-4 flex items-center gap-6">
        <button
          onClick={() => router.push('/')}
          className="flex items-center gap-2 text-stone-600 hover:text-cocoa-taupe transition-colors text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver a la tienda
        </button>
        <button
          onClick={() => router.push('/mi-cuenta')}
          className="text-sm text-stone-500 hover:text-cocoa-taupe transition-colors"
        >
          Nivel VIP
        </button>
      </nav>

      <div className="max-w-2xl mx-auto px-6 py-12 flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-serif text-stone-800">Mi dirección</h1>
          {direccion && !editando && (
            <Button
              onClick={() => {
                setErrorForm('');
                setEditando(true);
              }}
              className="bg-cocoa-taupe hover:bg-espresso-brown text-white rounded-full"
            >
              <Pencil className="w-4 h-4 mr-1" />
              Editar
            </Button>
          )}
        </div>

        {errorPagina && <p className="text-sm text-red-500">{errorPagina}</p>}

        {mostrarFormulario ? (
          <>
            {!direccion && (
              <p className="text-sm text-stone-500">
                Todavía no cargaste tu dirección. La vas a necesitar para pedir envíos a domicilio.
              </p>
            )}
            <FormularioDireccion
              key={direccion ? direccion.id_direccion : 'nueva'}
              provincias={provincias}
              inicial={direccion}
              guardando={guardando}
              error={errorForm}
              onGuardar={handleGuardar}
              onCancelar={() => setEditando(false)}
              puedeCancelar={!!direccion}
            />
          </>
        ) : (
          direccion && (
            <div className="bg-white border border-stone-200 rounded-2xl p-5 flex gap-4 items-start">
              <MapPin className="w-5 h-5 text-cocoa-taupe mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-stone-800">{direccion.nombre_destinatario}</p>
                <p className="text-sm text-stone-600">
                  {direccion.calle} {direccion.numero}
                  {direccion.piso_depto ? `, ${direccion.piso_depto}` : ''}
                </p>
                <p className="text-sm text-stone-600">
                  {direccion.localidad}, {direccion.provincia?.nombre} ({direccion.codigo_postal})
                </p>
                <p className="text-xs text-stone-400 mt-1">Tel: {direccion.telefono}</p>
                {direccion.observaciones && (
                  <p className="text-xs text-stone-400">{direccion.observaciones}</p>
                )}
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}
