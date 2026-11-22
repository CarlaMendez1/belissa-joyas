'use client';
import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { useSession } from 'next-auth/react';
import { GripVertical, Plus, Search, X, Gem } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getCarrusel, getProductos } from '@/lib/api';
import { guardarCarrusel } from '@/lib/admin-api';

const MAX = 7;

type Prod = { id_producto: number; nombre: string; imagenes?: string[]; precio_desde?: number | null; varios_precios?: boolean };

function Miniatura({ p, className }: { p: Prod; className: string }) {
  return (
    <div className={`relative shrink-0 overflow-hidden rounded-lg bg-blush-oat/40 ${className}`}>
      {p.imagenes?.[0] ? (
        <Image src={p.imagenes[0]} alt={p.nombre} fill sizes="64px" className="object-cover" />
      ) : (
        <div className="flex h-full items-center justify-center">
          <Gem className="h-5 w-5 text-dusty-rose" />
        </div>
      )}
    </div>
  );
}

function precio(p: Prod) {
  if (p.precio_desde == null) return '';
  return `${p.varios_precios ? 'Desde ' : ''}$${Math.round(p.precio_desde).toLocaleString('es-AR')}`;
}

export default function AdminCarruselPage() {
  const { data: session } = useSession();
  const token = (session as any)?.access_token;

  const [todos, setTodos] = useState<Prod[]>([]);
  const [elegidos, setElegidos] = useState<Prod[]>([]);
  const [original, setOriginal] = useState<number[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);
  const [arrastrando, setArrastrando] = useState<number | null>(null);
  const [sobre, setSobre] = useState<number | null>(null);

  useEffect(() => {
    Promise.all([getProductos(), getCarrusel()]).then(([prods, carr]) => {
      setTodos(prods);
      setElegidos(carr);
      setOriginal(carr.map((p: Prod) => p.id_producto));
      setCargando(false);
    });
  }, []);

  const hayCambios = useMemo(
    () => JSON.stringify(elegidos.map((p) => p.id_producto)) !== JSON.stringify(original),
    [elegidos, original],
  );

  const disponibles = useMemo(() => {
    const usados = new Set(elegidos.map((p) => p.id_producto));
    const q = busqueda.trim().toLowerCase();
    return todos.filter((p) => !usados.has(p.id_producto) && (!q || p.nombre.toLowerCase().includes(q)));
  }, [todos, elegidos, busqueda]);

  function soltar(destino: number) {
    if (arrastrando === null || arrastrando === destino) return;
    setElegidos((lista) => {
      const copia = [...lista];
      const [movido] = copia.splice(arrastrando, 1);
      copia.splice(destino, 0, movido);
      return copia;
    });
  }

  async function guardar() {
    setGuardando(true);
    setMensaje(null);
    try {
      const ids = elegidos.map((p) => p.id_producto);
      await guardarCarrusel(token, ids);
      setOriginal(ids);
      setMensaje({ tipo: 'ok', texto: 'Listo: el inicio de la tienda ya muestra este orden.' });
    } catch (e: any) {
      setMensaje({ tipo: 'error', texto: e.message || 'No se pudo guardar' });
    } finally {
      setGuardando(false);
    }
  }

  if (cargando) return <p className="p-8 text-stone-400">Cargando...</p>;

  const lleno = elegidos.length >= MAX;

  return (
    <div className="mx-auto max-w-3xl p-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl text-stone-800">Carrusel del inicio</h1>
          <p className="mt-1 text-sm text-stone-500">
            Elegí qué productos se muestran en el inicio y arrastralos para cambiar el orden.
          </p>
        </div>
        <Button
          onClick={guardar}
          disabled={!hayCambios || guardando}
          className="rounded-full bg-cocoa-taupe px-6 text-white hover:bg-espresso-brown"
        >
          {guardando ? 'Guardando...' : 'Guardar orden'}
        </Button>
      </div>

      {mensaje && (
        <p className={`mt-4 rounded-lg px-4 py-2 text-sm ${mensaje.tipo === 'ok' ? 'bg-blush-oat/50 text-espresso-brown' : 'bg-red-50 text-red-700'}`}>
          {mensaje.texto}
        </p>
      )}

      <section className="mt-6 rounded-xl border border-blush-oat bg-white p-5">
        <h2 className="font-medium text-stone-800">Mostrando en el inicio</h2>
        <p className="text-sm text-stone-500">{elegidos.length} de {MAX} lugares usados</p>

        {elegidos.length === 0 ? (
          <p className="mt-4 rounded-lg bg-stone-50 p-4 text-sm text-stone-500">
            No hay productos elegidos. Mientras tanto, el inicio muestra los primeros productos con foto.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-stone-100">
            {elegidos.map((p, i) => (
              <li
                key={p.id_producto}
                draggable
                onDragStart={() => setArrastrando(i)}
                onDragOver={(e) => { e.preventDefault(); setSobre(i); }}
                onDrop={() => { soltar(i); setArrastrando(null); setSobre(null); }}
                onDragEnd={() => { setArrastrando(null); setSobre(null); }}
                className={`flex cursor-grab items-center gap-3 py-3 transition-colors active:cursor-grabbing ${
                  arrastrando === i ? 'opacity-40' : ''
                } ${sobre === i && arrastrando !== null && arrastrando !== i ? 'bg-blush-oat/40' : ''}`}
              >
                <GripVertical className="h-5 w-5 text-dusty-rose" aria-hidden />
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blush-oat text-xs text-espresso-brown">
                  {i + 1}
                </span>
                <Miniatura p={p} className="h-14 w-14" />
                <span className="flex-1 text-stone-800">{p.nombre}</span>
                <span className="text-sm text-cocoa-taupe">{precio(p)}</span>
                <button
                  type="button"
                  onClick={() => setElegidos((l) => l.filter((x) => x.id_producto !== p.id_producto))}
                  className="flex items-center gap-1 text-sm text-red-600 hover:underline"
                >
                  <X className="h-4 w-4" /> Quitar
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {elegidos.length > 1 && (
        <section className="mt-6 rounded-xl border border-blush-oat bg-white p-5">
          <h2 className="font-medium text-stone-800">Vista previa</h2>
          <div className="mt-3 flex items-center justify-center gap-2 overflow-hidden py-2">
            {elegidos.slice(0, 5).map((p, i) => (
              <Miniatura
                key={p.id_producto}
                p={p}
                className={`shadow-md ${i === 0 ? 'h-32 w-24 ring-2 ring-dusty-rose' : 'h-24 w-[4.5rem] opacity-80'}`}
              />
            ))}
          </div>
          <p className="text-center text-xs text-stone-400">El primero es el que se ve al centro al abrir el inicio.</p>
        </section>
      )}

      <section className="mt-6 rounded-xl border border-blush-oat bg-white p-5">
        <h2 className="font-medium text-stone-800">Agregar productos</h2>
        <div className="relative mt-3">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
          <Input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar producto..."
            className="pl-9"
            aria-label="Buscar producto"
          />
        </div>
        {lleno && <p className="mt-3 text-sm text-stone-500">Ya usaste los {MAX} lugares. Quitá uno para agregar otro.</p>}
        <ul className="mt-2 divide-y divide-stone-100">
          {disponibles.map((p) => (
            <li key={p.id_producto} className="flex items-center gap-3 py-3">
              <Miniatura p={p} className="h-12 w-12" />
              <span className="flex-1 text-stone-800">{p.nombre}</span>
              <span className="text-sm text-cocoa-taupe">{precio(p)}</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={lleno}
                onClick={() => setElegidos((l) => [...l, p])}
                className="rounded-full border-dusty-rose text-cocoa-taupe"
              >
                <Plus className="mr-1 h-4 w-4" /> Agregar
              </Button>
            </li>
          ))}
          {disponibles.length === 0 && <li className="py-3 text-sm text-stone-400">No hay productos para agregar.</li>}
        </ul>
      </section>
    </div>
  );
}
