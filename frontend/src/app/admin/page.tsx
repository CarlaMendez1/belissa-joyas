'use client';
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { getCategorias } from '@/lib/api';
import {
  getSubcategoriasPorCategoria,
  crearCategoria, actualizarCategoria, eliminarCategoria,
  crearSubcategoria, actualizarSubcategoria, eliminarSubcategoria,
} from '@/lib/admin-api';
import { Plus, Pencil, Trash2, X, ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function AdminCategoriasPage() {
  const { data: session } = useSession();
  const token = (session as any)?.access_token;

  const [categorias, setCategorias] = useState<any[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  // Form de categoría
  const [mostrarForm, setMostrarForm] = useState(false);
  const [editando, setEditando] = useState<any>(null);
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [guardando, setGuardando] = useState(false);

  // Subcategorías: expandido + datos cargados por categoría
  const [expandida, setExpandida] = useState<number | null>(null);
  const [subcats, setSubcats] = useState<Record<number, any[]>>({});
  const [formSubcat, setFormSubcat] = useState<{ id_categoria: number; editando: any } | null>(null);
  const [nombreSub, setNombreSub] = useState('');
  const [descSub, setDescSub] = useState('');
  const [guardandoSub, setGuardandoSub] = useState(false);
  const [errorSub, setErrorSub] = useState('');

  async function cargar() {
    setCargando(true);
    const data = await getCategorias();
    setCategorias(data);
    setCargando(false);
  }

  useEffect(() => {
    cargar();
  }, []);

  // --- Categorías ---
  function abrirCrear() {
    setEditando(null);
    setNombre('');
    setDescripcion('');
    setError('');
    setMostrarForm(true);
  }

  function abrirEditar(categoria: any) {
    setEditando(categoria);
    setNombre(categoria.nombre);
    setDescripcion(categoria.descripcion || '');
    setError('');
    setMostrarForm(true);
  }

  function cerrarForm() {
    setMostrarForm(false);
    setEditando(null);
  }

  async function handleGuardar() {
    if (!nombre.trim()) {
      setError('El nombre es obligatorio');
      return;
    }
    setGuardando(true);
    setError('');
    try {
      if (editando) {
        await actualizarCategoria(token, editando.id_categoria, { nombre, descripcion });
      } else {
        await crearCategoria(token, { nombre, descripcion });
      }
      await cargar();
      cerrarForm();
    } catch (err: any) {
      setError(err.message || 'Error al guardar la categoría');
    }
    setGuardando(false);
  }

  async function handleEliminar(categoria: any) {
    if (!confirm(`¿Eliminar la categoría "${categoria.nombre}"?`)) return;
    try {
      await eliminarCategoria(token, categoria.id_categoria);
      await cargar();
    } catch (err: any) {
      alert(err.message || 'Error al eliminar la categoría');
    }
  }

  // --- Subcategorías ---
  async function toggleExpandir(id_categoria: number) {
    if (expandida === id_categoria) {
      setExpandida(null);
      return;
    }
    setExpandida(id_categoria);
    if (!subcats[id_categoria]) {
      const data = await getSubcategoriasPorCategoria(id_categoria);
      setSubcats((prev) => ({ ...prev, [id_categoria]: data }));
    }
  }

  async function recargarSubcats(id_categoria: number) {
    const data = await getSubcategoriasPorCategoria(id_categoria);
    setSubcats((prev) => ({ ...prev, [id_categoria]: data }));
  }

  function abrirCrearSub(id_categoria: number) {
    setFormSubcat({ id_categoria, editando: null });
    setNombreSub('');
    setDescSub('');
    setErrorSub('');
  }

  function abrirEditarSub(id_categoria: number, subcat: any) {
    setFormSubcat({ id_categoria, editando: subcat });
    setNombreSub(subcat.nombre);
    setDescSub(subcat.descripcion || '');
    setErrorSub('');
  }

  async function handleGuardarSub() {
    if (!nombreSub.trim() || !formSubcat) {
      setErrorSub('El nombre es obligatorio');
      return;
    }
    setGuardandoSub(true);
    setErrorSub('');
    try {
      if (formSubcat.editando) {
        await actualizarSubcategoria(token, formSubcat.editando.id_subcategoria, { nombre: nombreSub, descripcion: descSub });
      } else {
        await crearSubcategoria(token, { id_categoria: formSubcat.id_categoria, nombre: nombreSub, descripcion: descSub });
      }
      await recargarSubcats(formSubcat.id_categoria);
      setFormSubcat(null);
    } catch (err: any) {
      setErrorSub(err.message || 'Error al guardar la subcategoría');
    }
    setGuardandoSub(false);
  }

  async function handleEliminarSub(id_categoria: number, subcat: any) {
    if (!confirm(`¿Eliminar la subcategoría "${subcat.nombre}"?`)) return;
    try {
      await eliminarSubcategoria(token, subcat.id_subcategoria);
      await recargarSubcats(id_categoria);
    } catch (err: any) {
      alert(err.message || 'Error al eliminar la subcategoría');
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-serif text-stone-800">Categorías</h1>
        <Button
          onClick={abrirCrear}
          className="bg-amber-700 hover:bg-amber-800 text-white rounded-full flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Nueva categoría
        </Button>
      </div>

      {/* Formulario crear/editar categoría */}
      {mostrarForm && (
        <div className="bg-white border border-stone-200 rounded-xl p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-medium text-stone-800">
              {editando ? 'Editar categoría' : 'Nueva categoría'}
            </h2>
            <button onClick={cerrarForm}>
              <X className="w-4 h-4 text-stone-400 hover:text-stone-700" />
            </button>
          </div>
          <div className="flex flex-col gap-3">
            <div>
              <label className="text-sm text-stone-600 mb-1 block">Nombre</label>
              <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Anillos" />
            </div>
            <div>
              <label className="text-sm text-stone-600 mb-1 block">Descripción</label>
              <Input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Opcional" />
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
              <Button onClick={cerrarForm} variant="outline" className="rounded-full">
                Cancelar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Listado */}
      {cargando ? (
        <p className="text-stone-400">Cargando...</p>
      ) : categorias.length === 0 ? (
        <p className="text-stone-400">No hay categorías cargadas.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {categorias.map((cat: any) => (
            <div key={cat.id_categoria} className="bg-white border border-stone-200 rounded-xl overflow-hidden">
              {/* Fila de la categoría */}
              <div className="flex items-center justify-between px-4 py-3">
                <button
                  onClick={() => toggleExpandir(cat.id_categoria)}
                  className="flex items-center gap-2 text-left flex-1"
                >
                  {expandida === cat.id_categoria ? (
                    <ChevronDown className="w-4 h-4 text-stone-400" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-stone-400" />
                  )}
                  <span className="text-stone-800 font-medium">{cat.nombre}</span>
                  <span className="text-stone-400 text-sm">{cat.descripcion}</span>
                </button>
                <div className="flex gap-2">
                  <button onClick={() => abrirEditar(cat)} className="text-stone-400 hover:text-amber-700">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleEliminar(cat)} className="text-stone-400 hover:text-red-500">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Subcategorías expandidas */}
              {expandida === cat.id_categoria && (
                <div className="border-t border-stone-100 bg-stone-50 px-4 py-3">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-medium text-stone-600">Subcategorías</p>
                    <button
                      onClick={() => abrirCrearSub(cat.id_categoria)}
                      className="text-xs text-amber-700 hover:text-amber-800 flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" />
                      Agregar subcategoría
                    </button>
                  </div>

                  {/* Form subcategoría */}
                  {formSubcat?.id_categoria === cat.id_categoria && (
                    <div className="bg-white border border-stone-200 rounded-lg p-4 mb-3">
                      <div className="flex flex-col gap-2">
                        <Input
                          value={nombreSub}
                          onChange={(e) => setNombreSub(e.target.value)}
                          placeholder="Nombre de la subcategoría"
                        />
                        <Input
                          value={descSub}
                          onChange={(e) => setDescSub(e.target.value)}
                          placeholder="Descripción (opcional)"
                        />
                        {errorSub && <p className="text-xs text-red-500">{errorSub}</p>}
                        <div className="flex gap-2">
                          <Button
                            onClick={handleGuardarSub}
                            disabled={guardandoSub}
                            size="sm"
                            className="bg-amber-700 hover:bg-amber-800 text-white rounded-full"
                          >
                            {guardandoSub ? 'Guardando...' : 'Guardar'}
                          </Button>
                          <Button
                            onClick={() => setFormSubcat(null)}
                            size="sm"
                            variant="outline"
                            className="rounded-full"
                          >
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Listado de subcategorías */}
                  {!subcats[cat.id_categoria] ? (
                    <p className="text-xs text-stone-400">Cargando...</p>
                  ) : subcats[cat.id_categoria].length === 0 ? (
                    <p className="text-xs text-stone-400">No hay subcategorías todavía.</p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {subcats[cat.id_categoria].map((sub: any) => (
                        <div
                          key={sub.id_subcategoria}
                          className="flex items-center justify-between bg-white border border-stone-200 rounded-lg px-3 py-2"
                        >
                          <div>
                            <span className="text-sm text-stone-800">{sub.nombre}</span>
                            {sub.descripcion && (
                              <span className="text-xs text-stone-400 ml-2">{sub.descripcion}</span>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => abrirEditarSub(cat.id_categoria, sub)}
                              className="text-stone-400 hover:text-amber-700"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleEliminarSub(cat.id_categoria, sub)}
                              className="text-stone-400 hover:text-red-500"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}