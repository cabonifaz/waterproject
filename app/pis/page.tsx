// app/pis/page.tsx
// Lista de Programas Incrementales (PI) + alta de PI nuevo. Cada PI es el
// contenedor de sus sprints, células y proyectos.

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import Modal from '@/components/Modal';
import FormularioPI from '@/components/FormularioPI';
import { ProgramaIncremental } from '@/types';

const formatFecha = (f: Date | string | null) =>
  f ? new Date(String(f).slice(0, 10) + 'T00:00:00').toLocaleDateString('es') : 'Sin fecha';

export default function PisPage() {
  const router = useRouter();
  const [pis, setPis] = useState<ProgramaIncremental[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const cargar = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/pis');
      if (!res.ok) throw new Error('Error al obtener los PI');
      const data = await res.json();
      setPis(Array.isArray(data.data) ? data.data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargar();
  }, []);

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />

      <main className="flex-1 overflow-auto">
        <div className="max-w-5xl mx-auto p-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">🎯 Programas Incrementales</h1>
              <p className="text-gray-600 mt-2">
                Cada PI tiene sus propios sprints, sus células y sus proyectos.
              </p>
            </div>
            <button
              onClick={() => setShowForm(true)}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold transition-colors"
            >
              ➕ Nuevo PI
            </button>
          </div>

          {showForm && (
            <Modal titulo="Nuevo Programa Incremental" onClose={() => setShowForm(false)}>
              <FormularioPI onSuccess={(id) => router.push(`/pis/${id}`)} />
            </Modal>
          )}

          {loading && <div className="animate-pulse h-32 bg-gray-200 rounded" />}
          {error && <div className="text-red-600">Error: {error}</div>}

          {!loading && !error && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {pis.length === 0 && (
                <div className="col-span-full text-center text-gray-500 py-12">
                  No hay PI todavía. Creá el primero.
                </div>
              )}
              {pis.map((pi) => (
                <a
                  key={pi.id}
                  href={`/pis/${pi.id}`}
                  className="block bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-bold text-lg text-gray-900">{pi.nombre}</h3>
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-semibold uppercase ${
                        pi.estado === 'cerrado'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-green-50 text-green-700'
                      }`}
                    >
                      {pi.estado}
                    </span>
                  </div>
                  <div className="mt-2 text-sm text-gray-400">Inicio: {formatFecha(pi.fecha_inicio)}</div>
                  <div className="flex gap-3 mt-3 text-sm text-gray-600">
                    <span>🧩 {pi.celulas_count ?? 0} células</span>
                    <span>📁 {pi.proyectos_count ?? 0} proyectos</span>
                    <span>🗓️ {pi.sprints_count ?? 0} sprints</span>
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
