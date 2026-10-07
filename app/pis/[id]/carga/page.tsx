// app/pis/[id]/carga/page.tsx
// Carga del equipo de TODO el PI: junta las personas de todos los
// proyectos del PI (por nombre) para ver su carga total por día, por
// proyecto, por módulo y por sprint, y hasta qué día tienen tareas.

'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import CargaEquipoVista from '@/components/CargaEquipoVista';
import { Sprint } from '@/types';
import { FuenteCarga } from '@/lib/cargaEquipo';

export default function CargaPIPage() {
  const params = useParams();
  const piId = parseInt(params.id as string, 10);
  const [datos, setDatos] = useState<{ fuentes: FuenteCarga[]; sprints: Sprint[] } | null>(null);
  const [nombrePI, setNombrePI] = useState('');
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      const [rCarga, rPi] = await Promise.all([fetch(`/api/pis/${piId}/carga`), fetch(`/api/pis/${piId}`)]);
      const data = await rCarga.json();
      if (!rCarga.ok) throw new Error(data.error || 'Error al cargar la carga del equipo');
      setDatos(data.data);
      if (rPi.ok) setNombrePI((await rPi.json()).data?.nombre ?? '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    }
  }, [piId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <div className="max-w-[1920px] mx-auto p-6">
          <div className="flex justify-between items-center flex-wrap gap-3 mb-5">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">👥 Carga del equipo — {nombrePI || 'PI'}</h1>
              <p className="text-gray-600 text-sm mt-1">
                Todos los proyectos del PI{datos ? ` (${datos.fuentes.length})` : ''}. Una misma persona en varios
                proyectos se reconoce por su nombre.
              </p>
            </div>
            <a href={`/pis/${piId}`} className="text-sm text-blue-600 hover:text-blue-800 font-semibold">
              ← Volver al PI
            </a>
          </div>

          {error && <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm">{error}</div>}
          {!datos && !error && <div className="animate-pulse h-32 bg-gray-200 rounded" />}
          {datos && <CargaEquipoVista fuentes={datos.fuentes} sprints={datos.sprints} />}
        </div>
      </main>
    </div>
  );
}
