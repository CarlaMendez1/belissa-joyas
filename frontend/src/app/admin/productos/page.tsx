'use client';
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { getProductos, getSubcategorias } from '@/lib/api';
import { crearProducto, eliminarProducto } from '@/lib/admin-api';
import { Plus, Trash2, X, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import ConfirmDialog from '@/components/confirm-dialog';

export default function AdminProductosPage() {
  const { data: session } = useSession();
  const token = (session as any)?.access_token;

  const [productos, setProductos] = useState<any[]>([]);
  const [subcategorias, setSubcategorias] = useState<any[]>([]);
  const [cargando, setCargando] = useState(true);

  const [mostrarForm, setMostrarForm] = useState(false);
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [idSubcategoria, setIdSubcategoria] = useState<string>('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  const [confirmando, setConfirmando] = useState<any>(null);

  async function cargar() {
    setCargando(true);
    const [prods, subs] = await Promise.all([getProductos(), getSubcategorias()]);
    setProductos(prods);
    setSubcategorias(subs);
    setCargando(false);
  }

  useEffect(() => {
    cargar();
  }, []);

  function nombreSubcategoria(id_subcategoria: number) {
    return subcategorias.find((s: any) => s.id_subcategoria === id_subcategoria)?.nombre || '—';
  }

  function abrirCrear() {
    setNombre('');
    setDescripcion('');
    setIdSubcategoria(subcategorias[0] ? String(subcategorias[0].id_subcategoria) : '');
    setError('');
    setMostrarForm(true);
  }

  async function handleGuardar() {
    if (!nombre.trim() || !idSubcategoria) {
      setError('Nombre y subcategoría son obligatorios');
      return;
    }
    setGuardando(true);
    setError('');
    try {
      await crearProducto(token, {
        nombre,
        descripcion,
        id_subcategoria: Number(idSubcategoria),
      });
      await cargar();
      setMostrarForm(false);
    } catch (err: any) {
      setError(err.message || 'Error al crear el producto');
    }
    setGuardando(false);
  }

  function pedirEliminar(producto: any) {
    setConfirmando(producto);
  }

  async function confirmarEliminacion() {
    if (!confirmando) return;
    try {
      await eliminarProducto(token, confirmando.id_producto);
      await cargar();
    } catch (err: any) {
      alert(err.message || 'Error al eliminar el producto');
    }
    setConfirmando(null);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-serif text-stone-800">Productos</h1>
        <Button
          onClick={abrirCrear}
          className="bg-amber-700 hover:bg-amber-800 text-white rounded-full flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Nuevo producto
        </Button>
      </div>

      {mostrarForm && (
        <div className="bg-white border border-stone-200 rounded-xl p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-medium text-stone-800">Nuevo producto</h2>
            <button onClick={() => setMostrarForm(false)}>
              <X className="w-4 h-4 text-stone-400 hover:text-stone-700" />
            </button>
          </div>
          <div className="flex flex-col gap-3">
            <div>
              <label className="text-sm text-stone-600 mb-1 block">Nombre</label>
              <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Anillo Solitario" />
            </div>
            <div>
              <label className="text-sm text-stone-600 mb-1 block">Descripción</label>
              <Input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Opcional" />
            </div>
            <div>
              <label className="text-sm text-stone-600 mb-1 block">Subcategoría</label>
              <select
                value={idSubcategoria}
                onChange={(e) => setIdSubcategoria(e.target.value)}
                className="w-full border border-stone-300 rounded-md px-3 py-2 text-sm text-stone-700"
              >
                {subcategorias.map((s: any) => (
                  <option key={s.id_subcategoria} value={s.id_subcategoria}>
                    {s.nombre}
                  </option>
                ))}
              </select>
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <div className="flex gap-2 mt-2">
              <Button
                onClick={handleGuardar}
                disabled={guardando}
                className="bg-amber-700 hover:bg-amber-800 text-white rounded-full"
              >
                {guardando ? 'Guardando...' : 'Guardar'}
              </Button>
              <Button onClick={() => setMostrarForm(false)} variant="outline" className="rounded-full">
                Cancelar
              </Button>
            </div>
          </div>
        </div>
      )}

      {cargando ? (
        <p className="text-stone-400">Cargando...</p>
      ) : productos.length === 0 ? (
        <p className="text-stone-400">No hay productos cargados.</p>
      ) : (
        <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 text-stone-500 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">SKU</th>
                <th className="px-4 py-3 font-medium">Nombre</th>
                <th className="px-4 py-3 font-medium">Subcategoría</th>
                <th className="px-4 py-3 font-medium w-20">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {productos.map((p: any) => (
                <tr key={p.id_producto} className="border-t border-stone-100">
                  <td className="px-4 py-3 font-mono text-xs text-stone-500">{p.codigo_sku}</td>
                  <td className="px-4 py-3 text-stone-800">{p.nombre}</td>
                  <td className="px-4 py-3 text-stone-500">{nombreSubcategoria(p.id_subcategoria)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Link
                        href={`/admin/productos/${p.id_producto}`}
                        className="text-stone-400 hover:text-amber-700"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Link>
                      <button onClick={() => pedirEliminar(p)} className="text-stone-400 hover:text-red-500">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        abierto={!!confirmando}
        titulo="Eliminar producto"
        mensaje={`¿Eliminar el producto "${confirmando?.nombre}"? También se ocultarán sus variantes.`}
        onConfirmar={confirmarEliminacion}
        onCancelar={() => setConfirmando(null)}
      />
    </div>
  );
}