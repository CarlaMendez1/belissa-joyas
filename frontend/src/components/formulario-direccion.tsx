'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { Direccion, DireccionInput, Provincia } from '@/lib/api';

type Props = {
  provincias: Provincia[];
  inicial?: Direccion | null;
  guardando: boolean;
  error: string;
  onGuardar: (dto: DireccionInput) => void;
  onCancelar: () => void;
};

export default function FormularioDireccion({ provincias, inicial, guardando, error, onGuardar, onCancelar }: Props) {
  const [nombre, setNombre] = useState(inicial?.nombre_destinatario ?? '');
  const [telefono, setTelefono] = useState(inicial?.telefono ?? '');
  const [calle, setCalle] = useState(inicial?.calle ?? '');
  const [numero, setNumero] = useState(inicial?.numero ?? '');
  const [pisoDepto, setPisoDepto] = useState(inicial?.piso_depto ?? '');
  const [localidad, setLocalidad] = useState(inicial?.localidad ?? '');
  const [idProvincia, setIdProvincia] = useState<string>(inicial ? String(inicial.id_provincia) : '');
  const [codigoPostal, setCodigoPostal] = useState(inicial?.codigo_postal ?? '');
  const [observaciones, setObservaciones] = useState(inicial?.observaciones ?? '');
  const [predeterminada, setPredeterminada] = useState(inicial?.es_predeterminada ?? false);
  const [errorLocal, setErrorLocal] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorLocal('');

    if (!nombre.trim() || !telefono.trim() || !calle.trim() || !numero.trim() || !localidad.trim()) {
      setErrorLocal('Completá todos los campos obligatorios (*).');
      return;
    }
    if (!idProvincia) {
      setErrorLocal('Elegí una provincia.');
      return;
    }
    // La base de datos vuelve a validar esto; acá solo se avisa antes, con un mensaje claro
    if (!/^([0-9]{4}|[A-Za-z][0-9]{4}[A-Za-z]{3})$/.test(codigoPostal.trim())) {
      setErrorLocal('Código postal inválido. Ejemplos: 1425 o C1425ABC.');
      return;
    }

    onGuardar({
      nombre_destinatario: nombre,
      telefono,
      calle,
      numero,
      piso_depto: pisoDepto,
      localidad,
      id_provincia: Number(idProvincia),
      codigo_postal: codigoPostal.trim(),
      observaciones,
      es_predeterminada: predeterminada,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-stone-200 rounded-2xl p-6 flex flex-col gap-4">
      <h3 className="font-serif text-lg text-stone-800">
        {inicial ? 'Editar dirección' : 'Nueva dirección'}
      </h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="dir-nombre">Quién recibe *</Label>
          <Input id="dir-nombre" value={nombre} maxLength={100} onChange={(e) => setNombre(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="dir-telefono">Teléfono *</Label>
          <Input id="dir-telefono" value={telefono} maxLength={30} inputMode="tel" onChange={(e) => setTelefono(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="dir-calle">Calle *</Label>
          <Input id="dir-calle" value={calle} maxLength={120} onChange={(e) => setCalle(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="dir-numero">Número *</Label>
            <Input id="dir-numero" value={numero} maxLength={20} onChange={(e) => setNumero(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="dir-piso">Piso / Depto</Label>
            <Input id="dir-piso" value={pisoDepto} maxLength={30} onChange={(e) => setPisoDepto(e.target.value)} />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="dir-localidad">Localidad *</Label>
          <Input id="dir-localidad" value={localidad} maxLength={100} onChange={(e) => setLocalidad(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="dir-provincia">Provincia *</Label>
          <select
            id="dir-provincia"
            value={idProvincia}
            onChange={(e) => setIdProvincia(e.target.value)}
            className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <option value="">Elegí una provincia</option>
            {provincias.map((p) => (
              <option key={p.id_provincia} value={p.id_provincia}>
                {p.nombre}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="dir-cp">Código postal *</Label>
          <Input id="dir-cp" value={codigoPostal} maxLength={10} onChange={(e) => setCodigoPostal(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="dir-obs">Indicaciones para la entrega</Label>
          <Input id="dir-obs" value={observaciones} maxLength={255} onChange={(e) => setObservaciones(e.target.value)} />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-stone-600">
        <input
          type="checkbox"
          checked={predeterminada}
          onChange={(e) => setPredeterminada(e.target.checked)}
        />
        Usar como dirección predeterminada
      </label>

      {(errorLocal || error) && <p className="text-sm text-red-500">{errorLocal || error}</p>}

      <div className="flex gap-2 justify-end">
        <Button type="button" variant="outline" onClick={onCancelar} className="rounded-full">
          Cancelar
        </Button>
        <Button
          type="submit"
          disabled={guardando}
          className="bg-cocoa-taupe hover:bg-espresso-brown text-white rounded-full"
        >
          {guardando ? 'Guardando...' : 'Guardar dirección'}
        </Button>
      </div>
    </form>
  );
}
