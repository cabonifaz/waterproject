// app/proyectos/[id]/carga/page.tsx
// Carga del equipo del proyecto: por persona, hasta qué día tiene tareas,
// en qué módulos está, cuánto tiene por sprint y su carga día a día.

'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import CargaEquipoVista from '@/components/CargaEquipoVista';
import { EstructuraProyecto, Sprint } from '@/types';

export default function CargaProyectoPage() {
  const params = useParams();
  const proyectoId = parseInt(params.id as string, 10);
  const [estructura, setEstructura] = useState<EstructuraProyecto | null>(null);
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      const [rEst, rSpr] = await Promise.all([
        fetch(`/api/proyectos/${proyectoId}/estructura`),
        fetch(`/api/proyectos/${proyectoId}/sprints`),
      ]);
      if (!rEst.ok || !rSpr.ok) throw new Error('Error al cargar los datos del proyecto');
      setEstructura((await rEst.json()).data);
      setSprints((await rSpr.json()).data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    }
  }, [proyectoId]);

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
              <h1 className="text-2xl font-bold text-gray-900">👥 Carga del equipo</h1>
              {estructura && <p className="text-gray-600 text-sm mt-1">{estructura.proyecto.nombre}</p>}
            </div>
            <div className="flex items-center gap-3">
              {estructura?.proyecto.pi_id && (
                <a
                  href={`/pis/${estructura.proyecto.pi_id}/carga`}
                  className="px-4 py-2 rounded-lg text-sm font-semibold bg-white border-2 border-slate-300 text-slate-700 hover:bg-slate-50"
                >
                  Ver carga de todo el PI
                </a>
              )}
              <a href={`/proyectos/${proyectoId}`} className="text-sm text-blue-600 hover:text-blue-800 font-semibold">
                ← Volver a la estructura
              </a>
            </div>
          </div>

          {error && <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm">{error}</div>}
          {!estructura && !error && <div className="animate-pulse h-32 bg-gray-200 rounded" />}
          {estructura && (
            <CargaEquipoVista
              fuentes={[{ proyecto: { id: estructura.proyecto.id, nombre: estructura.proyecto.nombre }, estructura }]}
              sprints={sprints}
            />
          )}
        </div>
      </main>
    </div>
  );
}
