'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { getProducto, getVariantesPorProducto, getSubcategorias, getOpciones, getCaracteristicasPorOpcion } from '@/lib/api';
import {
  actualizarProducto, crearVariante, actualizarVariante, eliminarVariante,
} from '@/lib/admin-api';
import { ArrowLeft, Plus, Pencil, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import ConfirmDialog from '@/components/confirm-dialog';

export default function AdminProductoDetallePage() {
  const { id } = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  const token = (session as any)?.access_token;

  const [producto, setProducto] = useState<any>(null);
  const [variantes, setVariantes] = useState<any[]>([]);
  const [subcategorias, setSubcategorias] = useState<any[]>([]);
  const [opciones, setOpciones] = useState<any[]>([]);
  const [caractsPorOpcion, setCaractsPorOpcion] = useState<Record<number, any[]>>({});
  const [cargando, setCargando] = useState(true);

  // Edición de datos básicos
  const [editandoProducto, setEditandoProducto] = useState(false);
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [idSubcategoria, setIdSubcategoria] = useState('');
  const [guardandoProducto, setGuardandoProducto] = useState(false);
  const [errorProducto, setErrorProducto] = useState('');

  // Form de variante
  const [mostrarFormVar, setMostrarFormVar] = useState(false);
  const [editandoVar, setEditandoVar] = useState<any>(null);
  const [precioVar, setPrecioVar] = useState('');
  const [stockVar, setStockVar] = useState('');
  const [caractsSeleccionadas, setCaractsSeleccionadas] = useState<number[]>([]);
  const [guardandoVar, setGuardandoVar] = useState(false);
  const [errorVar, setErrorVar] = useState('');

  const [confirmandoVar, setConfirmandoVar] = useState<any>(null);

  async function cargar() {
    setCargando(true);
    const [prod, vars, subs, ops] = await Promise.all([
      getProducto(Number(id)),
      getVariantesPorProducto(Number(id)),
      getSubcategorias(),
      getOpciones(),
    ]);
    setProducto(prod);
    setVariantes(vars);
    setSubcategorias(subs);
    setOpciones(ops);

    // Precargamos las características de todas las opciones para el selector de variantes
    const mapa: Record<number, any[]> = {};
    await Promise.all(
      ops.map(async (op: any) => {
        mapa[op.id_opcion] = await getCaracteristicasPorOpcion(op.id_opcion);
      })
    );
    setCaractsPorOpcion(mapa);
    setCargando(false);
  }

  useEffect(() => {
    if (id) cargar();
  }, [id]);

  // --- Producto ---
  function abrirEditarProducto() {
    setNombre(producto.nombre);
    setDescripcion(producto.descripcion || '');
    setIdSubcategoria(String(producto.id_subcategoria));
    setErrorProducto('');
    setEditandoProducto(true);
  }

  async function handleGuardarProducto() {
    if (!nombre.trim()) {
      setErrorProducto('El nombre es obligatorio');
      return;
    }
    setGuardandoProducto(true);
    setErrorProducto('');
    try {
      await actualizarProducto(token, producto.id_producto, {
        nombre,
        descripcion,
        id_subcategoria: Number(idSubcategoria),
      });
      await cargar();
      setEditandoProducto(false);
    } catch (err: any) {
      setErrorProducto(err.message || 'Error al guardar el producto');
    }
    setGuardandoProducto(false);
  }

  // --- Variantes ---
  function abrirCrearVariante() {
    setEditandoVar(null);
    setPrecioVar('');
    setStockVar('0');
    setCaractsSeleccionadas([]);
    setErrorVar('');
    setMostrarFormVar(true);
  }

  function abrirEditarVariante(v: any) {
    setEditandoVar(v);
    setPrecioVar(String(v.precio_venta));
    setStockVar(String(v.stock_disponible));
    setCaractsSeleccionadas(v.caracteristicas?.map((c: any) => c.id_caracteristica) || []);
    setErrorVar('');
    setMostrarFormVar(true);
  }

  function toggleCaracteristica(id_caracteristica: number) {
    setCaractsSeleccionadas((prev) =>
      prev.includes(id_caracteristica)
        ? prev.filter((c) => c !== id_caracteristica)
        : [...prev, id_caracteristica]
    );
  }

  async function handleGuardarVariante() {
    const precio = Number(precioVar);
    const stock = Number(stockVar);
    if (!precio || precio <= 0) {
      setErrorVar('El precio debe ser mayor a 0');
      return;
    }
    setGuardandoVar(true);
    setErrorVar('');
    try {
      if (editandoVar) {
        await actualizarVariante(token, editandoVar.id_variante, {
          precio_venta: precio,
          stock_disponible: stock,
          caracteristicas: caractsSeleccionadas,
        });
      } else {
        await crearVariante(token, {
          id_producto: Number(id),
          precio_venta: precio,
          stock_disponible: stock,
          caracteristicas: caractsSeleccionadas,
        });
      }
      await cargar();
      setMostrarFormVar(false);
    } catch (err: any) {
      setErrorVar(err.message || 'Error al guardar la variante');
    }
    setGuardandoVar(false);
  }

  function pedirEliminarVariante(v: any) {
    setConfirmandoVar(v);
  }

  async function confirmarEliminarVariante() {
    if (!confirmandoVar) return;
    try {
      await eliminarVariante(token, confirmandoVar.id_variante);
      await cargar();
    } catch (err: any) {
      alert(err.message || 'Error al eliminar la variante');
    }
    setConfirmandoVar(null);
  }

  if (cargando || !producto) {
    return <p className="text-stone-400">Cargando...</p>;
  }

  return (
    <div>
      <button
        onClick={() => router.push('/admin/productos')}
        className="flex items-center gap-2 text-stone-600 hover:text-amber-700 text-sm mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Volver a productos
      </button>

      {/* Datos del producto */}
      <div className="bg-white border border-stone-200 rounded-xl p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs font-mono text-amber-700 mb-1">{producto.codigo_sku}</p>
            <h1 className="text-xl font-serif text-stone-800">{producto.nombre}</h1>
          </div>
          {!editandoProducto && (
            <button onClick={abrirEditarProducto} className="text-stone-400 hover:text-amber-700">
              <Pencil className="w-4 h-4" />
            </button>
          )}
        </div>

        {editandoProducto ? (
          <div className="flex flex-col gap-3">
            <div>
              <label className="text-sm text-stone-600 mb-1 block">Nombre</label>
              <Input value={nombre} onChange={(e) => setNombre(e.target.value)} />
            </div>
            <div>
              <label className="text-sm text-stone-600 mb-1 block">Descripción</label>
              <Input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
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
            {errorProducto && <p className="text-sm text-red-500">{errorProducto}</p>}
            <div className="flex gap-2 mt-2">
              <Button
                onClick={handleGuardarProducto}
                disabled={guardandoProducto}
                className="bg-amber-700 hover:bg-amber-800 text-white rounded-full"
              >
                {guardandoProducto ? 'Guardando...' : 'Guardar'}
              </Button>
              <Button onClick={() => setEditandoProducto(false)} variant="outline" className="rounded-full">
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-stone-500 text-sm">{producto.descripcion || 'Sin descripción'}</p>
        )}
      </div>

      {/* Variantes */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-serif text-stone-800">Variantes</h2>
        <Button
          onClick={abrirCrearVariante}
          className="bg-amber-700 hover:bg-amber-800 text-white rounded-full flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Nueva variante
        </Button>
      </div>

      {mostrarFormVar && (
        <div className="bg-white border border-stone-200 rounded-xl p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium text-stone-800">
              {editandoVar ? `Editar variante ${editandoVar.codigo_sku}` : 'Nueva variante'}
            </h3>
            <button onClick={() => setMostrarFormVar(false)}>
              <X className="w-4 h-4 text-stone-400 hover:text-stone-700" />
            </button>
          </div>
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-stone-600 mb-1 block">Precio</label>
                <Input type="number" value={precioVar} onChange={(e) => setPrecioVar(e.target.value)} placeholder="15000" />
              </div>
              <div>
                <label className="text-sm text-stone-600 mb-1 block">Stock</label>
                <Input type="number" value={stockVar} onChange={(e) => setStockVar(e.target.value)} placeholder="10" />
              </div>
            </div>

            {opciones.map((op: any) => (
              <div key={op.id_opcion}>
                <p className="text-sm text-stone-600 mb-2">{op.nombre}</p>
                <div className="flex flex-wrap gap-2">
                  {(caractsPorOpcion[op.id_opcion] || []).map((c: any) => {
                    const seleccionada = caractsSeleccionadas.includes(c.id_caracteristica);
                    return (
                      <button
                        key={c.id_caracteristica}
                        type="button"
                        onClick={() => toggleCaracteristica(c.id_caracteristica)}
                        className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${
                          seleccionada
                            ? 'bg-amber-700 text-white border-amber-700'
                            : 'bg-white text-stone-600 border-stone-300 hover:border-amber-400'
                        }`}
                      >
                        {c.valor}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            {errorVar && <p className="text-sm text-red-500">{errorVar}</p>}
            <div className="flex gap-2">
              <Button
                onClick={handleGuardarVariante}
                disabled={guardandoVar}
                className="bg-amber-700 hover:bg-amber-800 text-white rounded-full"
              >
                {guardandoVar ? 'Guardando...' : 'Guardar'}
              </Button>
              <Button onClick={() => setMostrarFormVar(false)} variant="outline" className="rounded-full">
                Cancelar
              </Button>
            </div>
          </div>
        </div>
      )}

      {variantes.length === 0 ? (
        <p className="text-stone-400 text-sm">No hay variantes cargadas todavía.</p>
      ) : (
        <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 text-stone-500 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">SKU</th>
                <th className="px-4 py-3 font-medium">Características</th>
                <th className="px-4 py-3 font-medium">Precio</th>
                <th className="px-4 py-3 font-medium">Stock</th>
                <th className="px-4 py-3 font-medium w-20">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {variantes.map((v: any) => (
                <tr key={v.id_variante} className="border-t border-stone-100">
                  <td className="px-4 py-3 font-mono text-xs text-stone-500">{v.codigo_sku}</td>
                  <td className="px-4 py-3 text-stone-600">
                    {v.caracteristicas?.map((c: any) => c.valor).join(', ') || '—'}
                  </td>
                  <td className="px-4 py-3 text-stone-800">
                    ${Number(v.precio_venta).toLocaleString('es-AR')}
                  </td>
                  <td className="px-4 py-3 text-stone-600">{v.stock_disponible}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button onClick={() => abrirEditarVariante(v)} className="text-stone-400 hover:text-amber-700">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => pedirEliminarVariante(v)} className="text-stone-400 hover:text-red-500">
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
        abierto={!!confirmandoVar}
        titulo="Eliminar variante"
        mensaje={`¿Eliminar la variante "${confirmandoVar?.codigo_sku}"?`}
        onConfirmar={confirmarEliminarVariante}
        onCancelar={() => setConfirmandoVar(null)}
      />
    </div>
  );
}