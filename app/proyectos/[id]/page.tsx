// app/proyectos/[id]/page.tsx
// Estructura completa del proyecto: Etapas -> (Tareas Matrices | Módulos -> Épicas -> HU)

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import Modal from '@/components/Modal';
import FormularioEtapa from '@/components/FormularioEtapa';
import EtapaSeccion from '@/components/EtapaSeccion';
import ModalEliminarProyecto from '@/components/ModalEliminarProyecto';
import MiembrosSeccion from '@/components/MiembrosSeccion';
import { EstructuraProyecto } from '@/types';
import { calcularTotalesPlanificados } from '@/lib/planificacion';

export default function ProyectoEstructuraPage() {
  const params = useParams();
  const router = useRouter();
  const proyectoId = parseInt(params.id as string, 10);

  const [estructura, setEstructura] = useState<EstructuraProyecto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mostrarFormEtapa, setMostrarFormEtapa] = useState(false);
  const [mostrarEliminar, setMostrarEliminar] = useState(false);
  const [mostrarMiembros, setMostrarMiembros] = useState(false);

  const cargarEstructura = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/proyectos/${proyectoId}/estructura`);
      if (!res.ok) throw new Error('Error al obtener la estructura del proyecto');
      const data = await res.json();
      setEstructura(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  }, [proyectoId]);

  useEffect(() => {
    cargarEstructura();
  }, [cargarEstructura]);

  const totalGeneral = useMemo(() => {
    if (!estructura) return 0;
    const totales = calcularTotalesPlanificados(estructura);
    return totales.desarrollo + totales.certificacion;
  }, [estructura]);

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />

      <main className="flex-1 overflow-auto">
        <div className="max-w-5xl mx-auto p-6">
          {loading && <div className="animate-pulse h-32 bg-gray-200 rounded" />}
          {error && <div className="text-red-600">Error: {error}</div>}

          {!loading && !error && estructura && (
            <>
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h1 className="text-3xl font-bold text-gray-900">{estructura.proyecto.nombre}</h1>
                  {estructura.proyecto.descripcion && (
                    <p className="text-gray-600 mt-2">{estructura.proyecto.descripcion}</p>
                  )}
                </div>
                <div className="flex gap-3">
                  <a
                    href="/sprints"
                    className="px-6 py-3 bg-white border-2 border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 font-semibold transition-colors"
                  >
                    🗓️ Sprints y Feriados
                  </a>
                  <a
                    href={`/proyectos/${proyectoId}/gantt`}
                    className="px-6 py-3 bg-slate-800 text-white rounded-lg hover:bg-slate-900 font-semibold transition-colors"
                  >
                    📊 Planificado
                  </a>
                  <a
                    href={`/proyectos/${proyectoId}/gantt-real`}
                    className="px-6 py-3 bg-white border-2 border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 font-semibold transition-colors"
                  >
                    🎯 REAL
                  </a>
                  <a
                    href={`/proyectos/${proyectoId}/avance-cedula`}
                    className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-semibold transition-colors"
                  >
                    📋 Avance Célula
                  </a>
                  <button
                    onClick={() => setMostrarMiembros(true)}
                    className="px-6 py-3 bg-white border-2 border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 font-semibold transition-colors"
                  >
                    👥 Miembros
                  </button>
                  <button
                    onClick={() => setMostrarFormEtapa(true)}
                    className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold transition-colors"
                  >
                    ➕ Nueva Etapa
                  </button>
                  <button
                    onClick={() => setMostrarEliminar(true)}
                    className="px-4 py-3 bg-white border-2 border-red-200 text-red-600 rounded-lg hover:bg-red-50 font-semibold transition-colors"
                    title="Eliminar todo el proyecto"
                  >
                    🗑️
                  </button>
                </div>
              </div>

              {estructura.etapas.length === 0 && (
                <div className="text-center text-gray-500 py-12 bg-white rounded-lg shadow">
                  Sin etapas todavía. Empezá agregando una (ej. &quot;Análisis y Diseño&quot;).
                </div>
              )}

              {estructura.etapas.map((etapa) => (
                <EtapaSeccion
                  key={etapa.id}
                  etapa={etapa}
                  miembrosProyecto={estructura.miembros}
                  totalGeneral={totalGeneral}
                  onRefrescar={cargarEstructura}
                />
              ))}
            </>
          )}

          {mostrarMiembros && estructura && (
            <Modal titulo="Miembros del Proyecto" onClose={() => setMostrarMiembros(false)}>
              <MiembrosSeccion
                proyectoId={proyectoId}
                miembros={estructura.miembros}
                onRefrescar={cargarEstructura}
              />
            </Modal>
          )}

          {mostrarFormEtapa && estructura && (
            <Modal titulo="Nueva Etapa" onClose={() => setMostrarFormEtapa(false)}>
              <FormularioEtapa
                proyectoId={proyectoId}
                yaExisteDesarrollo={estructura.etapas.some((e) => e.tipo === 'desarrollo')}
                onSuccess={() => {
                  setMostrarFormEtapa(false);
                  cargarEstructura();
                }}
              />
            </Modal>
          )}

          {mostrarEliminar && estructura && (
            <ModalEliminarProyecto
              proyectoId={proyectoId}
              nombreProyecto={estructura.proyecto.nombre}
              onClose={() => setMostrarEliminar(false)}
              onEliminado={() => router.push('/proyectos')}
            />
          )}
        </div>
      </main>
    </div>
  );
}
