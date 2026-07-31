'use client';
import { useRouter } from 'next/navigation';
import { Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function PagoPendientePage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-stone-200 p-8 text-center flex flex-col items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center">
          <Clock className="w-9 h-9 text-amber-600" />
        </div>
        <h1 className="text-2xl font-serif text-stone-800">Pago pendiente</h1>
        <p className="text-stone-500 leading-relaxed">
          Tu pago está siendo procesado. Te avisaremos por email en cuanto se confirme.
        </p>
        <Button
          onClick={() => router.push('/')}
          className="w-full mt-4 bg-amber-700 hover:bg-amber-800 text-white rounded-full"
        >
          Volver al catálogo
        </Button>
      </div>
    </div>
  );
}