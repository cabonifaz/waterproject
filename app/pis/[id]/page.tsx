// app/pis/[id]/page.tsx
// Detalle de un Programa Incremental: sus sprints, sus células y sus
// proyectos agrupados por célula. Desde acá se crean los proyectos.

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import Modal from '@/components/Modal';
import SprintsSeccion from '@/components/SprintsSeccion';
import FormularioNombreSimple from '@/components/FormularioNombreSimple';
import FormularioPI from '@/components/FormularioPI';
import FormularioProyecto from '@/components/FormularioProyecto';
import { ProgramaIncremental, Celula, Sprint, Proyecto, Semaforo } from '@/types';

const SEMAFORO_COLOR: Record<Semaforo, string> = {
  verde: 'bg-green-500',
  amarillo: 'bg-yellow-400',
  rojo: 'bg-red-500',
  negro: 'bg-gray-400',
};

const SIN_CELULA = -1;

export default function PiDetallePage() {
  const params = useParams();
  const router = useRouter();
  const piId = parseInt(params.id as string, 10);

  const [pi, setPi] = useState<ProgramaIncremental | null>(null);
  const [celulas, setCelulas] = useState<Celula[]>([]);
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [proyectos, setProyectos] = useState<Proyecto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editandoPI, setEditandoPI] = useState(false);
  const [nuevaCelula, setNuevaCelula] = useState(false);
  const [renombrando, setRenombrando] = useState<Celula | null>(null);
  const [nuevoProyectoEn, setNuevoProyectoEn] = useState<number | null>(null); // celula_id | SIN_CELULA

  const cargar = useCallback(async () => {
    try {
      setLoading(true);
      const [rPi, rCel, rSpr, rPro] = await Promise.all([
        fetch(`/api/pis/${piId}`),
        fetch(`/api/pis/${piId}/celulas`),
        fetch(`/api/pis/${piId}/sprints`),
        fetch(`/api/pis/${piId}/proyectos`),
      ]);
      if (!rPi.ok) throw new Error('Error al obtener el PI');
      if (!rCel.ok || !rSpr.ok || !rPro.ok) throw new Error('Error al cargar el detalle del PI');
      setPi((await rPi.json()).data);
      setCelulas((await rCel.json()).data || []);
      setSprints((await rSpr.json()).data || []);
      setProyectos((await rPro.json()).data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  }, [piId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const proyectosPorCelula = useMemo(() => {
    const mapa = new Map<number, Proyecto[]>();
    for (const p of proyectos) {
      const clave = p.celula_id ?? SIN_CELULA;
      const lista = mapa.get(clave) || [];
      lista.push(p);
      mapa.set(clave, lista);
    }
    return mapa;
  }, [proyectos]);

  const eliminarPI = async () => {
    if (!confirm(`¿Eliminar el PI "${pi?.nombre}"? Se borran sus células y sprints.`)) return;
    const res = await fetch(`/api/pis/${piId}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || 'No se pudo eliminar el PI');
      return;
    }
    router.push('/pis');
  };

  const eliminarCelula = async (c: Celula) => {
    if (!confirm(`¿Eliminar la célula "${c.nombre}"? Sus proyectos quedan sin célula.`)) return;
    const res = await fetch(`/api/celulas/${c.id}`, { method: 'DELETE' });
    if (!res.ok) {
      alert('No se pudo eliminar la célula');
      return;
    }
    cargar();
  };

  const renombrarCelula = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!renombrando) return;
    const nombre = new FormData(e.currentTarget).get('nombre') as string;
    const res = await fetch(`/api/celulas/${renombrando.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre }),
    });
    if (!res.ok) {
      alert('No se pudo renombrar');
      return;
    }
    setRenombrando(null);
    cargar();
  };

  const bloques: { id: number; nombre: string; celulaId: number | null }[] = [
    ...celulas.map((c) => ({ id: c.id, nombre: c.nombre, celulaId: c.id })),
    { id: SIN_CELULA, nombre: 'Sin célula', celulaId: null },
  ];

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />

      <main className="flex-1 overflow-auto">
        <div className="max-w-5xl mx-auto p-6">
          <a href="/pis" className="text-sm text-blue-600 hover:text-blue-800">
            ← Programas Incrementales
          </a>

          {loading && <div className="animate-pulse h-32 bg-gray-200 rounded mt-4" />}
          {error && <div className="text-red-600 mt-4">Error: {error}</div>}

          {!loading && !error && pi && (
            <>
              <div className="flex justify-between items-start mt-2 mb-6">
                <div>
                  <div className="flex items-center gap-3">
                    <h1 className="text-3xl font-bold text-gray-900">{pi.nombre}</h1>
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-semibold uppercase ${
                        pi.estado === 'cerrado' ? 'bg-amber-100 text-amber-800' : 'bg-green-50 text-green-700'
                      }`}
                    >
                      {pi.estado}
                    </span>
                  </div>
                  {pi.fecha_inicio && (
                    <p className="text-gray-500 mt-1 text-sm">
                      Inicio: {new Date(String(pi.fecha_inicio).slice(0, 10) + 'T00:00:00').toLocaleDateString('es')}
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setEditandoPI(true)}
                    className="px-4 py-2 bg-white border-2 border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 font-semibold"
                  >
                    ✏️ Editar PI
                  </button>
                  <button
                    onClick={eliminarPI}
                    className="px-4 py-2 bg-white border-2 border-red-200 text-red-600 rounded-lg hover:bg-red-50 font-semibold"
                    title="Eliminar PI"
                  >
                    🗑️
                  </button>
                </div>
              </div>

              <SprintsSeccion piId={piId} sprints={sprints} onRefrescar={cargar} />

              {/* Células */}
              <div className="bg-white rounded-lg shadow p-4 mb-6">
                <div className="flex justify-between items-center mb-3">
                  <h2 className="font-bold text-gray-900">🧩 Células</h2>
                  <button
                    onClick={() => setNuevaCelula(true)}
                    className="text-xs px-3 py-1.5 bg-blue-100 hover:bg-blue-200 rounded-lg font-semibold text-blue-700"
                  >
                    ➕ Nueva Célula
                  </button>
                </div>
                {celulas.length === 0 ? (
                  <p className="text-sm text-gray-400">
                    Sin células todavía. Creá las que ejecutan proyectos en este PI.
                  </p>
                ) : (
                  <div className="flex gap-2 flex-wrap">
                    {celulas.map((c) => (
                      <span
                        key={c.id}
                        className="inline-flex items-center gap-2 border rounded-lg px-3 py-1.5 bg-slate-50 border-slate-200 text-sm"
                      >
                        {c.nombre}
                        <button
                          onClick={() => setRenombrando(c)}
                          className="text-slate-400 hover:text-slate-700"
                          title="Renombrar"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => eliminarCelula(c)}
                          className="text-slate-400 hover:text-red-600"
                          title="Eliminar"
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Proyectos por célula */}
              <h2 className="font-bold text-gray-900 mb-3">📁 Proyectos por célula</h2>
              <div className="space-y-6">
                {bloques.map((b) => {
                  const lista = proyectosPorCelula.get(b.id) || [];
                  if (b.id === SIN_CELULA && lista.length === 0) return null;
                  return (
                    <div key={b.id}>
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold text-slate-700">
                          {b.nombre} <span className="text-slate-400 font-normal">({lista.length})</span>
                        </h3>
                        {b.id !== SIN_CELULA && (
                          <button
                            onClick={() => setNuevoProyectoEn(b.id)}
                            className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold"
                          >
                            ➕ Nuevo Proyecto
                          </button>
                        )}
                      </div>
                      {lista.length === 0 ? (
                        <p className="text-sm text-gray-400">Sin proyectos en esta célula.</p>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                          {lista.map((p) => (
                            <a
                              key={p.id}
                              href={`/proyectos/${p.id}`}
                              className="block bg-white rounded-lg shadow p-4 hover:shadow-md transition-shadow"
                            >
                              <h4 className="font-bold text-gray-900">{p.nombre}</h4>
                              {p.descripcion && (
                                <p className="text-sm text-gray-600 mt-1 line-clamp-2">{p.descripcion}</p>
                              )}
                              <div className="flex items-center gap-2 mt-2 flex-wrap">
                                <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full text-xs font-semibold uppercase">
                                  {p.estado}
                                </span>
                                <span
                                  className={`px-2 py-0.5 rounded-full text-xs font-semibold uppercase ${
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
                                  {p.porcentajeCumplimiento == null
                                    ? 'Sin avance real'
                                    : `${p.porcentajeCumplimiento}% cumplimiento`}
                                </span>
                              </div>
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
                {celulas.length === 0 && (
                  <p className="text-sm text-gray-400">Creá una célula para poder cargar proyectos.</p>
                )}
              </div>
            </>
          )}

          {editandoPI && pi && (
            <Modal titulo="Editar PI" onClose={() => setEditandoPI(false)}>
              <FormularioPI
                pi={pi}
                onSuccess={() => {
                  setEditandoPI(false);
                  cargar();
                }}
              />
            </Modal>
          )}

          {nuevaCelula && (
            <Modal titulo="Nueva Célula" onClose={() => setNuevaCelula(false)}>
              <FormularioNombreSimple
                endpoint={`/api/pis/${piId}/celulas`}
                parentField="pi_id"
                parentId={piId}
                labelNombre="Nombre de la célula"
                onSuccess={() => {
                  setNuevaCelula(false);
                  cargar();
                }}
              />
            </Modal>
          )}

          {renombrando && (
            <Modal titulo={`Renombrar "${renombrando.nombre}"`} onClose={() => setRenombrando(null)}>
              <form onSubmit={renombrarCelula} className="space-y-4">
                <input
                  name="nombre"
                  defaultValue={renombrando.nombre}
                  required
                  autoFocus
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="submit"
                  className="w-full px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold"
                >
                  ✓ Guardar
                </button>
              </form>
            </Modal>
          )}

          {nuevoProyectoEn != null && (
            <Modal titulo="Nuevo Proyecto" onClose={() => setNuevoProyectoEn(null)}>
              <FormularioProyecto
                piId={piId}
                celulaId={nuevoProyectoEn === SIN_CELULA ? null : nuevoProyectoEn}
                onSuccess={(id) => router.push(`/proyectos/${id}`)}
              />
            </Modal>
          )}
        </div>
      </main>
    </div>
  );
}
