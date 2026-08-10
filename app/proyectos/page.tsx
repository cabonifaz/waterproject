// app/proyectos/page.tsx
// Lista de proyectos + alta de proyecto nuevo

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import FormularioProyecto from '@/components/FormularioProyecto';
import { Proyecto, Semaforo } from '@/types';

const SEMAFORO_COLOR: Record<Semaforo, string> = {
  verde: 'bg-green-500',
  amarillo: 'bg-yellow-400',
  rojo: 'bg-red-500',
  negro: 'bg-gray-400',
};

export default function ProyectosPage() {
  const router = useRouter();
  const [proyectos, setProyectos] = useState<Proyecto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    const fetchProyectos = async () => {
      try {
        setLoading(true);
        const res = await fetch('/api/proyectos');
        if (!res.ok) throw new Error('Error al obtener proyectos');
        const data = await res.json();
        setProyectos(Array.isArray(data.data) ? data.data : []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error desconocido');
      } finally {
        setLoading(false);
      }
    };
    fetchProyectos();
  }, [showForm]);

  const handleCreado = (id: number) => {
    setShowForm(false);
    router.push(`/proyectos/${id}`);
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />

      <main className="flex-1 overflow-auto">
        <div className="max-w-5xl mx-auto p-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Proyectos</h1>
              <p className="text-gray-600 mt-2">Elegí un proyecto o creá uno nuevo</p>
            </div>
            <button
              onClick={() => setShowForm(true)}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold transition-colors"
            >
              ➕ Nuevo Proyecto
            </button>
          </div>

          {showForm && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-lg max-w-lg w-full">
                <div className="border-b p-6 flex justify-between items-center">
                  <h2 className="text-2xl font-bold">Nuevo Proyecto</h2>
                  <button onClick={() => setShowForm(false)} className="text-gray-500 hover:text-gray-700 text-2xl">
                    ✕
                  </button>
                </div>
                <div className="p-6">
                  <FormularioProyecto onSuccess={handleCreado} />
                </div>
              </div>
            </div>
          )}

          {loading && <div className="animate-pulse h-32 bg-gray-200 rounded" />}
          {error && <div className="text-red-600">Error: {error}</div>}

          {!loading && !error && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {proyectos.length === 0 && (
                <div className="col-span-full text-center text-gray-500 py-12">
                  No hay proyectos todavía. Creá el primero.
                </div>
              )}
              {proyectos.map((p) => (
                <a
                  key={p.id}
                  href={`/proyectos/${p.id}`}
                  className="block bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow"
                >
                  <h3 className="font-bold text-lg text-gray-900">{p.nombre}</h3>
                  {p.descripcion && <p className="text-sm text-gray-600 mt-1 line-clamp-2">{p.descripcion}</p>}

                  <div className="flex items-center gap-2 mt-3 flex-wrap">
                    <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-semibold uppercase">
                      {p.estado}
                    </span>
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-semibold uppercase ${
                        p.estado_planificacion === 'cerrado'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {p.estado_planificacion === 'cerrado' ? '🔒 Cerrado' : '🔓 Abierto'}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 mt-2 text-sm">
                    <span
                      className={`w-2.5 h-2.5 rounded-full inline-block flex-shrink-0 ${
                        SEMAFORO_COLOR[p.semaforo || 'negro']
                      }`}
                    />
                    <span className="text-gray-700 font-semibold">
                      {p.porcentajeCumplimiento == null ? 'Sin avance real' : `${p.porcentajeCumplimiento}% cumplimiento`}
                    </span>
                  </div>

                  <div className="mt-3 text-sm text-gray-400">{new Date(p.fecha_inicio).toLocaleDateString()}</div>
                </a>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
