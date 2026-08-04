'use client';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

type ConfirmDialogProps = {
  abierto: boolean;
  titulo: string;
  mensaje: string;
  onConfirmar: () => void;
  onCancelar: () => void;
};

export default function ConfirmDialog({ abierto, titulo, mensaje, onConfirmar, onCancelar }: ConfirmDialogProps) {
  if (!abierto) return null;

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-5 h-5 text-red-600" />
          </div>
          <h2 className="font-medium text-stone-800">{titulo}</h2>
        </div>
        <p className="text-sm text-stone-500">{mensaje}</p>
        <div className="flex gap-2 justify-end mt-2">
          <Button onClick={onCancelar} variant="outline" className="rounded-full">
            Cancelar
          </Button>
          <Button onClick={onConfirmar} className="bg-red-600 hover:bg-red-700 text-white rounded-full">
            Eliminar
          </Button>
        </div>
      </div>
    </div>
  );
}