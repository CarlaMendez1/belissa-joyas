'use client';
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  getAdministradores,
  agregarAdministrador,
  quitarAdministrador,
  type ListaAdministradores,
} from '@/lib/admin-api';

type Sesion = { access_token?: string; user?: { email?: string | null } } | null;

export default function AdminAdministradoresPage() {
  const { data: session } = useSession();
  const sesion = session as Sesion;
  const token = sesion?.access_token;
  const miEmail = sesion?.user?.email?.toLowerCase();

  const [admins, setAdmins] = useState<ListaAdministradores | null>(null);
  const [recarga, setRecarga] = useState(0);
  const [email, setEmail] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);

  useEffect(() => {
    if (!token) return;
    let activo = true;
    getAdministradores(token)
      .then((lista) => activo && setAdmins(lista))
      .catch((err) => activo && setMensaje({ tipo: 'error', texto: err instanceof Error ? err.message : 'No se pudo cargar' }));
    return () => {
      activo = false;
    };
  }, [token, recarga]);

  async function agregar(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !email.trim()) return;
    setEnviando(true);
    setMensaje(null);
    try {
      const nuevo = await agregarAdministrador(token, email);
      setMensaje({
        tipo: 'ok',
        texto: `${nuevo.nombre} ${nuevo.apellido} ya es administrador. Para ver el panel tiene que cerrar sesión y volver a entrar.`,
      });
      setEmail('');
      setRecarga((n) => n + 1);
    } catch (err) {
      setMensaje({ tipo: 'error', texto: err instanceof Error ? err.message : 'No se pudo agregar' });
    } finally {
      setEnviando(false);
    }
  }

  async function quitar(a: ListaAdministradores['administradores'][number]) {
    if (!token) return;
    if (!window.confirm(`¿Quitar el permiso de administrador a ${a.nombre} ${a.apellido}? Pasará a ser cliente.`)) return;
    setMensaje(null);
    try {
      await quitarAdministrador(token, a.id_usuario);
      setMensaje({
        tipo: 'ok',
        texto: `${a.nombre} ${a.apellido} ya no es administrador. El cambio se aplica por completo cuando su sesión actual se cierre (hasta 24 h).`,
      });
      setRecarga((n) => n + 1);
    } catch (err) {
      setMensaje({ tipo: 'error', texto: err instanceof Error ? err.message : 'No se pudo quitar' });
    }
  }

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-serif text-stone-800 mb-2">Administradores</h1>
        <p className="text-sm text-stone-500">
          Dale permiso de administrador a un usuario que ya tenga cuenta en la tienda, usando su email.
        </p>
      </div>

      {admins?.puede_gestionar && (
        <form onSubmit={agregar} className="bg-white border border-stone-200 rounded-2xl p-5 flex flex-col sm:flex-row gap-3 sm:items-end">
          <label className="flex-1 text-xs text-stone-500">
            <span className="block mb-1">Email del usuario</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="cliente@email.com"
              className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-700 focus:outline-none focus:border-dusty-rose"
            />
          </label>
          <Button type="submit" disabled={enviando} className="rounded-full">
            {enviando ? 'Agregando...' : 'Hacer administrador'}
          </Button>
        </form>
      )}
      {admins && !admins.puede_gestionar && (
        <p className="text-sm text-stone-500">Solo el administrador principal puede agregar o quitar administradores.</p>
      )}

      {mensaje && (
        <p className={`text-sm ${mensaje.tipo === 'ok' ? 'text-emerald-600' : 'text-red-500'}`}>{mensaje.texto}</p>
      )}

      <div className="bg-white border border-stone-200 rounded-2xl divide-y divide-stone-100">
        {admins === null && <p className="p-5 text-sm text-stone-400">Cargando...</p>}
        {admins?.administradores.map((a) => {
          const soyYo = a.email.toLowerCase() === miEmail;
          return (
            <div key={a.id_usuario} className="flex items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="text-sm text-stone-800 truncate">
                  {a.nombre} {a.apellido}
                  {a.es_principal && <span className="ml-2 text-xs text-stone-400">(principal)</span>}
                  {soyYo && <span className="ml-2 text-xs text-stone-400">(vos)</span>}
                </p>
                <p className="text-xs text-stone-400 truncate">{a.email}</p>
              </div>
              {admins.puede_gestionar && !soyYo && (
                <button
                  onClick={() => quitar(a)}
                  title="Quitar permiso de administrador"
                  className="text-stone-400 hover:text-red-500 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
