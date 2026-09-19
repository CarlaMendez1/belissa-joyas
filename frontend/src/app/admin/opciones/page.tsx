'use client';
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { getOpciones, getCaracteristicasPorOpcion, getCategorias } from '@/lib/api';
import {
  crearOpcion, actualizarOpcion, eliminarOpcion,
  crearCaracteristica, actualizarCaracteristica, eliminarCaracteristica,
} from '@/lib/admin-api';
import { Plus, Pencil, Trash2, X, ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import ConfirmDialog from '@/components/confirm-dialog';

export default function AdminOpcionesPage() {
  const { data: session } = useSession();
  const token = (session as any)?.access_token;

  const [opciones, setOpciones] = useState<any[]>([]);
  const [categorias, setCategorias] = useState<any[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  const [mostrarForm, setMostrarForm] = useState(false);
  const [editando, setEditando] = useState<any>(null);
  const [nombre, setNombre] = useState('');
  const [categoriasSeleccionadas, setCategoriasSeleccionadas] = useState<number[]>([]);
  const [guardando, setGuardando] = useState(false);

  const [expandida, setExpandida] = useState<number | null>(null);
  const [caracts, setCaracts] = useState<Record<number, any[]>>({});
  const [formCaract, setFormCaract] = useState<{ id_opcion: number; editando: any } | null>(null);
  const [valorCaract, setValorCaract] = useState('');
  const [guardandoCaract, setGuardandoCaract] = useState(false);
  const [errorCaract, setErrorCaract] = useState('');

  const [confirmando, setConfirmando] = useState<
    { tipo: 'opcion'; item: any } | { tipo: 'caracteristica'; id_opcion: number; item: any } | null
  >(null);
  async function cargar() {
    setCargando(true);
    const [ops, cats] = await Promise.all([getOpciones(), getCategorias()]);
    setOpciones(ops);
    setCategorias(cats);
    setCargando(false);
  }

  useEffect(() => {
    cargar();
  }, []);

  function abrirCrear() {
    setEditando(null);
    setNombre('');
    setCategoriasSeleccionadas([]);
    setError('');
    setMostrarForm(true);
  }

  function abrirEditar(opcion: any) {
    setEditando(opcion);
    setNombre(opcion.nombre);
    setCategoriasSeleccionadas((opcion.categorias || []).map((c: any) => c.id_categoria));
    setError('');
    setMostrarForm(true);
  }

  function cerrarForm() {
    setMostrarForm(false);
    setEditando(null);
  }

  function toggleCategoria(id_categoria: number) {
    setCategoriasSeleccionadas((prev) =>
      prev.includes(id_categoria)
        ? prev.filter((c) => c !== id_categoria)
        : [...prev, id_categoria]
    );
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
        await actualizarOpcion(token, editando.id_opcion, { nombre, categorias: categoriasSeleccionadas });
      } else {
        await crearOpcion(token, { nombre, categorias: categoriasSeleccionadas });
      }
      await cargar();
      cerrarForm();
    } catch (err: any) {
      setError(err.message || 'Error al guardar la opción');
    }
    setGuardando(false);
  }

  function pedirEliminarOpcion(opcion: any) {
    setConfirmando({ tipo: 'opcion', item: opcion });
  }

  function pedirEliminarCaract(id_opcion: number, caract: any) {
    setConfirmando({ tipo: 'caracteristica', id_opcion, item: caract });
  }

  async function confirmarEliminacion() {
    if (!confirmando) return;
    try {
      if (confirmando.tipo === 'opcion') {
        await eliminarOpcion(token, confirmando.item.id_opcion);
        await cargar();
      } else {
        await eliminarCaracteristica(token, confirmando.item.id_caracteristica);
        await recargarCaracts(confirmando.id_opcion);
      }
    } catch (err: any) {
      alert(err.message || 'Error al eliminar');
    }
    setConfirmando(null);
  }

  async function toggleExpandir(id_opcion: number) {
    if (expandida === id_opcion) {
      setExpandida(null);
      return;
    }
    setExpandida(id_opcion);
    if (!caracts[id_opcion]) {
      const data = await getCaracteristicasPorOpcion(id_opcion);
      setCaracts((prev) => ({ ...prev, [id_opcion]: data }));
    }
  }

  async function recargarCaracts(id_opcion: number) {
    const data = await getCaracteristicasPorOpcion(id_opcion);
    setCaracts((prev) => ({ ...prev, [id_opcion]: data }));
  }

  function abrirCrearCaract(id_opcion: number) {
    setFormCaract({ id_opcion, editando: null });
    setValorCaract('');
    setErrorCaract('');
  }

  function abrirEditarCaract(id_opcion: number, caract: any) {
    setFormCaract({ id_opcion, editando: caract });
    setValorCaract(caract.valor);
    setErrorCaract('');
  }

  async function handleGuardarCaract() {
    if (!valorCaract.trim() || !formCaract) {
      setErrorCaract('El valor es obligatorio');
      return;
    }
    setGuardandoCaract(true);
    setErrorCaract('');
    try {
      if (formCaract.editando) {
        await actualizarCaracteristica(token, formCaract.editando.id_caracteristica, { valor: valorCaract });
      } else {
        await crearCaracteristica(token, { id_opcion: formCaract.id_opcion, valor: valorCaract });
      }
      await recargarCaracts(formCaract.id_opcion);
      setFormCaract(null);
    } catch (err: any) {
      setErrorCaract(err.message || 'Error al guardar la característica');
    }
    setGuardandoCaract(false);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-serif text-stone-800">Opciones y características</h1>
        <Button
          onClick={abrirCrear}
          className="bg-amber-700 hover:bg-amber-800 text-white rounded-full flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Nueva opción
        </Button>
      </div>

      <p className="text-sm text-stone-500 mb-6">
        Las opciones son los tipos de variación de un producto (ej. Material, Talle). Cada opción tiene
        sus propios valores posibles, llamados características (ej. "Oro 18k", "16"), y aplica solo a
        las categorías que elijas.
      </p>

      {mostrarForm && (
        <div className="bg-white border border-stone-200 rounded-xl p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-medium text-stone-800">
              {editando ? 'Editar opción' : 'Nueva opción'}
            </h2>
            <button onClick={cerrarForm}>
              <X className="w-4 h-4 text-stone-400 hover:text-stone-700" />
            </button>
          </div>
          <div className="flex flex-col gap-3">
            <div>
              <label className="text-sm text-stone-600 mb-1 block">Nombre</label>
              <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Material" />
            </div>

            <div>
              <label className="text-sm text-stone-600 mb-2 block">Categorías donde aplica</label>
              {categorias.length === 0 ? (
                <p className="text-xs text-stone-400">No hay categorías cargadas todavía.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {categorias.map((cat: any) => {
                    const seleccionada = categoriasSeleccionadas.includes(cat.id_categoria);
                    return (
                      <button
                        key={cat.id_categoria}
                        type="button"
                        onClick={() => toggleCategoria(cat.id_categoria)}
                        className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${
                          seleccionada
                            ? 'bg-amber-700 text-white border-amber-700'
                            : 'bg-white text-stone-600 border-stone-300 hover:border-amber-400'
                        }`}
                      >
                        {cat.nombre}
                      </button>
                    );
                  })}
                </div>
              )}
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

      {cargando ? (
        <p className="text-stone-400">Cargando...</p>
      ) : opciones.length === 0 ? (
        <p className="text-stone-400">No hay opciones cargadas.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {opciones.map((op: any) => (
            <div key={op.id_opcion} className="bg-white border border-stone-200 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3">
                <button
                  onClick={() => toggleExpandir(op.id_opcion)}
                  className="flex items-center gap-2 text-left flex-1"
                >
                  {expandida === op.id_opcion ? (
                    <ChevronDown className="w-4 h-4 text-stone-400" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-stone-400" />
                  )}
                  <div>
                    <span className="text-stone-800 font-medium">{op.nombre}</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {(op.categorias || []).length === 0 ? (
                        <span className="text-xs text-stone-400 italic">Sin categorías asignadas</span>
                      ) : (
                        op.categorias.map((c: any) => (
                          <span
                            key={c.id_categoria}
                            className="text-xs bg-stone-100 text-stone-600 rounded-full px-2 py-0.5"
                          >
                            {c.nombre}
                          </span>
                        ))
                      )}
                    </div>
                  </div>
                </button>
                <div className="flex gap-2">
                  <button onClick={() => abrirEditar(op)} className="text-stone-400 hover:text-amber-700">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => pedirEliminarOpcion(op)} className="text-stone-400 hover:text-red-500">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {expandida === op.id_opcion && (
                <div className="border-t border-stone-100 bg-stone-50 px-4 py-3">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-medium text-stone-600">Valores posibles</p>
                    <button
                      onClick={() => abrirCrearCaract(op.id_opcion)}
                      className="text-xs text-amber-700 hover:text-amber-800 flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" />
                      Agregar valor
                    </button>
                  </div>

                  {formCaract?.id_opcion === op.id_opcion && (
                    <div className="bg-white border border-stone-200 rounded-lg p-4 mb-3">
                      <div className="flex flex-col gap-2">
                        <Input
                          value={valorCaract}
                          onChange={(e) => setValorCaract(e.target.value)}
                          placeholder="Ej: Oro 18k"
                        />
                        {errorCaract && <p className="text-xs text-red-500">{errorCaract}</p>}
                        <div className="flex gap-2">
                          <Button
                            onClick={handleGuardarCaract}
                            disabled={guardandoCaract}
                            size="sm"
                            className="bg-amber-700 hover:bg-amber-800 text-white rounded-full"
                          >
                            {guardandoCaract ? 'Guardando...' : 'Guardar'}
                          </Button>
                          <Button
                            onClick={() => setFormCaract(null)}
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

                  {!caracts[op.id_opcion] ? (
                    <p className="text-xs text-stone-400">Cargando...</p>
                  ) : caracts[op.id_opcion].length === 0 ? (
                    <p className="text-xs text-stone-400">No hay valores cargados todavía.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {caracts[op.id_opcion].map((c: any) => (
                        <div
                          key={c.id_caracteristica}
                          className="flex items-center gap-2 bg-white border border-stone-200 rounded-full pl-3 pr-2 py-1"
                        >
                          <span className="text-sm text-stone-800">{c.valor}</span>
                          <button
                            onClick={() => abrirEditarCaract(op.id_opcion, c)}
                            className="text-stone-400 hover:text-amber-700"
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => pedirEliminarCaract(op.id_opcion, c)}
                            className="text-stone-400 hover:text-red-500"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
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

      <ConfirmDialog
        abierto={!!confirmando}
        titulo={confirmando?.tipo === 'opcion' ? 'Eliminar opción' : 'Eliminar valor'}
        mensaje={
          confirmando?.tipo === 'opcion'
            ? `¿Eliminar la opción "${confirmando.item.nombre}"? También se eliminarán sus características.`
            : `¿Eliminar el valor "${confirmando?.item.valor}"?`
        }
        onConfirmar={confirmarEliminacion}
        onCancelar={() => setConfirmando(null)}
      />
    </div>
  );
}