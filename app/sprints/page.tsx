// app/sprints/page.tsx
// Plantilla global de Sprints + calendario de Feriados. Ambos son
// compartidos por todos los proyectos — no se cargan por proyecto.

'use client';

import { useCallback, useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import SprintsSeccion from '@/components/SprintsSeccion';
import CalendarioFeriados from '@/components/CalendarioFeriados';
import { Sprint, Feriado } from '@/types';

export default function SprintsPage() {
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [feriados, setFeriados] = useState<Feriado[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      setLoading(true);
      const [resSprints, resFeriados] = await Promise.all([fetch('/api/sprints'), fetch('/api/feriados')]);
      if (!resSprints.ok || !resFeriados.ok) throw new Error('Error al cargar sprints o feriados');
      const dataSprints = await resSprints.json();
      const dataFeriados = await resFeriados.json();
      setSprints(dataSprints.data || []);
      setFeriados(dataFeriados.data || []);
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
          <h1 className="text-3xl font-bold text-gray-900 mb-1">🗓️ Sprints y Feriados</h1>
          <p className="text-gray-500 mb-6">
            Plantilla global compartida por todos los proyectos — definen las columnas del Gantt.
          </p>

          {loading && <div className="animate-pulse h-32 bg-gray-200 rounded" />}
          {error && <div className="text-red-600">Error: {error}</div>}

          {!loading && !error && (
            <>
              <SprintsSeccion sprints={sprints} onRefrescar={cargar} />

              <div className="mt-6">
                <h2 className="font-bold text-gray-900 mb-2">🚫 Feriados</h2>
                <p className="text-sm text-gray-500 mb-3">
                  Click en un día para marcarlo/desmarcarlo como feriado. Se excluye del Gantt junto con los fines
                  de semana.
                </p>
                <CalendarioFeriados feriados={feriados} onToggleDia={toggleFeriado} />
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
