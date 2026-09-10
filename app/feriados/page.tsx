// app/feriados/page.tsx
// Calendario de Feriados — globales, compartidos por todos los proyectos
// de todos los PI. Se excluyen del Gantt junto con los fines de semana.

'use client';

import { useCallback, useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import CalendarioFeriados from '@/components/CalendarioFeriados';
import { Feriado } from '@/types';

export default function FeriadosPage() {
  const [feriados, setFeriados] = useState<Feriado[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/feriados');
      if (!res.ok) throw new Error('Error al cargar feriados');
      const data = await res.json();
      setFeriados(data.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const toggleFeriado = async (fechaISO: string) => {
    const yaEra = feriados.some((f) => String(f.fecha).slice(0, 10) === fechaISO);
    setFeriados((prev) =>
      yaEra
        ? prev.filter((f) => String(f.fecha).slice(0, 10) !== fechaISO)
        : [...prev, { id: -1, fecha: fechaISO as any, created_at: new Date() }]
    );
    try {
      const res = await fetch('/api/feriados', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fecha: fechaISO }),
      });
      if (!res.ok) throw new Error('Error al marcar el feriado');
      const data = await res.json();
      setFeriados(data.data || []);
    } catch {
      cargar();
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />

      <main className="flex-1 overflow-auto">
        <div className="max-w-5xl mx-auto p-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-1">🚫 Feriados</h1>
          <p className="text-gray-500 mb-6">
            Globales para todos los proyectos. Click en un día para marcarlo/desmarcarlo — se excluye del Gantt
            junto con los fines de semana.
          </p>

          {loading && <div className="animate-pulse h-32 bg-gray-200 rounded" />}
          {error && <div className="text-red-600">Error: {error}</div>}

          {!loading && !error && <CalendarioFeriados feriados={feriados} onToggleDia={toggleFeriado} />}
        </div>
      </main>
    </div>
  );
}
