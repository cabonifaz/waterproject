// app/proyectos/[id]/observaciones/page.tsx
// Inventario de observaciones del proyecto: lista completa (más antiguas
// y abiertas primero, tal como la devuelve la API) con filtros por
// responsable, HU, módulo, estado, iteraciones mínimas, si tiene imágenes
// y búsqueda de texto libre. Clickear una fila abre el detalle completo
// (mismo componente que usa el Gantt Real).

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import Modal from '@/components/Modal';
import DetalleObservacion from '@/components/DetalleObservacion';
import { ObservacionInventario, EstadoObservacion, Miembro, CorteObservaciones } from '@/types';
import { ESTADOS_OBSERVACION, ESTADO_LABEL, ESTADO_COLOR, formatFecha, formatFechaHora } from '@/lib/observacionesUI';

type FiltroId = number | 'todos';

interface Filtros {
  responsableId: FiltroId;
  huId: FiltroId;
  moduloId: FiltroId;
  estado: EstadoObservacion | 'todos';
  minIteraciones: number;
  conImagenes: 'todos' | 'si' | 'no';
  busqueda: string;
}

const FILTROS_INICIALES: Filtros = {
  responsableId: 'todos',
  huId: 'todos',
  moduloId: 'todos',
  estado: 'todos',
  minIteraciones: 0,
  conImagenes: 'todos',
  busqueda: '',
};

export default function InventarioObservacionesPage() {
  const params = useParams();
  const proyectoId = parseInt(params.id as string, 10);

  const [proyectoNombre, setProyectoNombre] = useState('');
  const [observaciones, setObservaciones] = useState<ObservacionInventario[]>([]);
  const [miembrosProyecto, setMiembrosProyecto] = useState<Miembro[]>([]);
  const [cortes, setCortes] = useState<CorteObservaciones[]>([]);
  const [guardandoCorte, setGuardandoCorte] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filtros, setFiltros] = useState<Filtros>(FILTROS_INICIALES);
  const [detalleId, setDetalleId] = useState<number | null>(null);
  const [sidebarAbierto, setSidebarAbierto] = useState(true);

  const cargar = useCallback(async () => {
    try {
      setLoading(true);
      const [resObs, resProyecto, resMiembros, resCortes] = await Promise.all([
        fetch(`/api/proyectos/${proyectoId}/observaciones`),
        fetch(`/api/proyectos/${proyectoId}`),
        fetch(`/api/proyectos/${proyectoId}/miembros`),
        fetch(`/api/proyectos/${proyectoId}/observaciones/cortes`),
      ]);
      const dataObs = await resObs.json();
      if (!resObs.ok) throw new Error(dataObs.error || 'Error al obtener el inventario');
      setObservaciones(dataObs.data);
      const dataProyecto = await resProyecto.json();
      if (resProyecto.ok) setProyectoNombre(dataProyecto.data?.nombre || '');
      const dataMiembros = await resMiembros.json();
      if (resMiembros.ok) setMiembrosProyecto(dataMiembros.data || []);
      const dataCortes = await resCortes.json();
      if (resCortes.ok) setCortes(dataCortes.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  }, [proyectoId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // Resumen en vivo (siempre refleja el estado actual, no requiere
  // guardar un corte) — una HU está "abierta" si le queda al menos una
  // observación sin certificar.
  const resumenHU = useMemo(() => {
    const porHU = new Map<number, ObservacionInventario[]>();
    for (const o of observaciones) {
      const lista = porHU.get(o.historia_usuario_id) || [];
      lista.push(o);
      porHU.set(o.historia_usuario_id, lista);
    }
    let huAbiertas = 0;
    let huCertificadas = 0;
    for (const lista of porHU.values()) {
      if (lista.every((o) => o.estado === 'certificada')) huCertificadas++;
      else huAbiertas++;
    }
    return { totalHU: porHU.size, huAbiertas, huCertificadas };
  }, [observaciones]);

  const handleGuardarCorte = async () => {
    setGuardandoCorte(true);
    setError(null);
    try {
      const res = await fetch(`/api/proyectos/${proyectoId}/observaciones/cortes`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al guardar el corte');
      setCortes((prev) => [...prev, data.data]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el corte');
    } finally {
      setGuardandoCorte(false);
    }
  };

  // Opciones de filtro derivadas de los datos ya cargados — solo aparecen
  // HU/módulos/responsables que efectivamente tienen alguna observación.
  const opcionesHU = useMemo(() => {
    const mapa = new Map<number, string>();
    for (const o of observaciones) mapa.set(o.historia_usuario_id, (o.huCodigo ? `${o.huCodigo} — ` : '') + o.huTitulo);
    return Array.from(mapa.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [observaciones]);

  const opcionesModulo = useMemo(() => {
    const mapa = new Map<number, string>();
    for (const o of observaciones) mapa.set(o.moduloId, o.moduloNombre);
    return Array.from(mapa.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [observaciones]);

  const opcionesResponsable = useMemo(() => {
    const mapa = new Map<number, Miembro>();
    for (const o of observaciones) for (const m of o.miembros) mapa.set(m.id, m);
    return Array.from(mapa.values()).sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [observaciones]);

  const filtradas = useMemo(() => {
    const b = filtros.busqueda.trim().toLowerCase();
    return observaciones.filter((o) => {
      if (filtros.responsableId !== 'todos' && !o.miembros.some((m) => m.id === filtros.responsableId)) return false;
      if (filtros.huId !== 'todos' && o.historia_usuario_id !== filtros.huId) return false;
      if (filtros.moduloId !== 'todos' && o.moduloId !== filtros.moduloId) return false;
      if (filtros.estado !== 'todos' && o.estado !== filtros.estado) return false;
      if (o.iteraciones < filtros.minIteraciones) return false;
      if (filtros.conImagenes === 'si' && o.cantidad_imagenes === 0) return false;
      if (filtros.conImagenes === 'no' && o.cantidad_imagenes > 0) return false;
      if (b && !o.titulo.toLowerCase().includes(b) && !(o.descripcion || '').toLowerCase().includes(b)) return false;
      return true;
    });
  }, [observaciones, filtros]);

  const hayFiltrosActivos = JSON.stringify(filtros) !== JSON.stringify(FILTROS_INICIALES);

  const selectClass = 'text-sm px-3 py-2 border border-gray-300 rounded-lg bg-white';

  return (
    <div className="flex h-screen bg-gray-50">
      {sidebarAbierto && <Sidebar />}

      <main className="flex-1 overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSidebarAbierto((v) => !v)}
                title={sidebarAbierto ? 'Ocultar menú' : 'Mostrar menú'}
                className="w-9 h-9 flex items-center justify-center rounded-lg border border-gray-200 bg-white hover:bg-gray-100 text-gray-600 flex-shrink-0"
              >
                {sidebarAbierto ? '⟨' : '☰'}
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">🔍 Inventario de Observaciones</h1>
                {proyectoNombre && <p className="text-gray-600 text-sm mt-1">{proyectoNombre}</p>}
              </div>
            </div>
            <a
              href={`/proyectos/${proyectoId}/gantt-real`}
              className="text-sm text-blue-600 hover:text-blue-800 font-semibold"
            >
              ← Volver al Gantt Real
            </a>
          </div>

          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm">{error}</div>
          )}

          {loading ? (
            <div className="animate-pulse h-32 bg-gray-200 rounded" />
          ) : (
            <>
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="bg-white rounded-lg shadow p-4">
                  <p className="text-xs text-gray-500 font-semibold">HU con observaciones</p>
                  <p className="text-2xl font-bold text-gray-900">{resumenHU.totalHU}</p>
                </div>
                <div className="bg-white rounded-lg shadow p-4">
                  <p className="text-xs text-gray-500 font-semibold">HU abiertas</p>
                  <p className="text-2xl font-bold text-red-600">{resumenHU.huAbiertas}</p>
                </div>
                <div className="bg-white rounded-lg shadow p-4">
                  <p className="text-xs text-gray-500 font-semibold">HU certificadas</p>
                  <p className="text-2xl font-bold text-green-600">{resumenHU.huCertificadas}</p>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-4 mb-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold text-gray-700">
                    📈 Cortes de avance — evolución de HU abiertas/certificadas
                  </p>
                  <button
                    onClick={handleGuardarCorte}
                    disabled={guardandoCorte}
                    className="px-4 py-2 rounded-lg text-sm font-semibold bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50"
                  >
                    {guardandoCorte ? '⏳ Guardando...' : '📸 Guardar corte ahora'}
                  </button>
                </div>
                {cortes.length === 0 ? (
                  <p className="text-xs text-gray-400">
                    Todavía no guardaste ningún corte. Guardá uno cuando quieras dejar registrado el avance de este
                    momento — podés guardar tantos como necesites (por día, por hora, etc.) para comparar la
                    evolución.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="text-gray-500 border-b">
                        <tr>
                          <th className="px-2 py-1.5 text-left font-semibold">Fecha y hora</th>
                          <th className="px-2 py-1.5 text-center font-semibold">HU con obs.</th>
                          <th className="px-2 py-1.5 text-center font-semibold">HU abiertas</th>
                          <th className="px-2 py-1.5 text-center font-semibold">HU certificadas</th>
                          <th className="px-2 py-1.5 text-center font-semibold">Δ abiertas</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cortes.map((c, i) => {
                          const anterior = cortes[i - 1];
                          const delta = anterior ? c.hu_abiertas - anterior.hu_abiertas : null;
                          return (
                            <tr key={c.id} className="border-b last:border-b-0">
                              <td className="px-2 py-1.5 text-gray-600 whitespace-nowrap">{formatFechaHora(c.fecha_hora)}</td>
                              <td className="px-2 py-1.5 text-center">{c.total_hu_con_observaciones}</td>
                              <td className="px-2 py-1.5 text-center font-semibold text-red-600">{c.hu_abiertas}</td>
                              <td className="px-2 py-1.5 text-center font-semibold text-green-600">{c.hu_certificadas}</td>
                              <td className="px-2 py-1.5 text-center">
                                {delta == null ? (
                                  '—'
                                ) : delta < 0 ? (
                                  <span className="text-green-600 font-semibold">▼ {Math.abs(delta)}</span>
                                ) : delta > 0 ? (
                                  <span className="text-red-600 font-semibold">▲ {delta}</span>
                                ) : (
                                  <span className="text-gray-400">= 0</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="bg-white rounded-lg shadow p-4 mb-4 flex flex-wrap items-end gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Estado</label>
                  <select
                    value={filtros.estado}
                    onChange={(e) => setFiltros((f) => ({ ...f, estado: e.target.value as Filtros['estado'] }))}
                    className={selectClass}
                  >
                    <option value="todos">Todos</option>
                    {ESTADOS_OBSERVACION.map((e) => (
                      <option key={e} value={e}>
                        {ESTADO_LABEL[e]}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Responsable</label>
                  <select
                    value={filtros.responsableId}
                    onChange={(e) =>
                      setFiltros((f) => ({ ...f, responsableId: e.target.value === 'todos' ? 'todos' : Number(e.target.value) }))
                    }
                    className={selectClass}
                  >
                    <option value="todos">Todos</option>
                    {opcionesResponsable.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.iniciales} · {m.nombre}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Historia de Usuario</label>
                  <select
                    value={filtros.huId}
                    onChange={(e) =>
                      setFiltros((f) => ({ ...f, huId: e.target.value === 'todos' ? 'todos' : Number(e.target.value) }))
                    }
                    className={`${selectClass} max-w-[220px]`}
                  >
                    <option value="todos">Todas</option>
                    {opcionesHU.map(([id, label]) => (
                      <option key={id} value={id}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Módulo</label>
                  <select
                    value={filtros.moduloId}
                    onChange={(e) =>
                      setFiltros((f) => ({ ...f, moduloId: e.target.value === 'todos' ? 'todos' : Number(e.target.value) }))
                    }
                    className={selectClass}
                  >
                    <option value="todos">Todos</option>
                    {opcionesModulo.map(([id, nombre]) => (
                      <option key={id} value={id}>
                        {nombre}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Iteraciones mín.</label>
                  <input
                    type="number"
                    min={0}
                    value={filtros.minIteraciones}
                    onChange={(e) => setFiltros((f) => ({ ...f, minIteraciones: Math.max(0, Number(e.target.value) || 0) }))}
                    className={`${selectClass} w-24`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Imágenes</label>
                  <select
                    value={filtros.conImagenes}
                    onChange={(e) => setFiltros((f) => ({ ...f, conImagenes: e.target.value as Filtros['conImagenes'] }))}
                    className={selectClass}
                  >
                    <option value="todos">Todas</option>
                    <option value="si">Con imágenes</option>
                    <option value="no">Sin imágenes</option>
                  </select>
                </div>

                <div className="flex-1 min-w-[180px]">
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Buscar</label>
                  <input
                    type="text"
                    value={filtros.busqueda}
                    onChange={(e) => setFiltros((f) => ({ ...f, busqueda: e.target.value }))}
                    placeholder="Título o descripción..."
                    className={`${selectClass} w-full`}
                  />
                </div>

                {hayFiltrosActivos && (
                  <button
                    onClick={() => setFiltros(FILTROS_INICIALES)}
                    className="text-sm text-gray-500 hover:text-gray-700 font-semibold underline"
                  >
                    Limpiar filtros
                  </button>
                )}
              </div>

              <p className="text-sm text-gray-500 mb-3">
                {filtradas.length} de {observaciones.length} observación{observaciones.length === 1 ? '' : 'es'} — ordenadas
                por abiertas primero y más antiguas primero.
              </p>

              <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold">Título</th>
                      <th className="px-3 py-2 text-left font-semibold">HU</th>
                      <th className="px-3 py-2 text-left font-semibold">Módulo</th>
                      <th className="px-3 py-2 text-center font-semibold">Estado</th>
                      <th className="px-3 py-2 text-center font-semibold">Iteraciones</th>
                      <th className="px-3 py-2 text-center font-semibold">Imágenes</th>
                      <th className="px-3 py-2 text-left font-semibold">Responsable(s)</th>
                      <th className="px-3 py-2 text-left font-semibold">Creada</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtradas.map((o) => (
                      <tr
                        key={o.id}
                        onClick={() => setDetalleId(o.id)}
                        className="border-b last:border-b-0 hover:bg-blue-50 cursor-pointer"
                      >
                        <td className="px-3 py-2 font-medium text-gray-900">{o.titulo}</td>
                        <td className="px-3 py-2 text-gray-600">{o.huCodigo ? `${o.huCodigo} — ` : ''}{o.huTitulo}</td>
                        <td className="px-3 py-2 text-gray-600">{o.moduloNombre}</td>
                        <td className="px-3 py-2 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${ESTADO_COLOR[o.estado]}`}>
                            {ESTADO_LABEL[o.estado]}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-center">{o.iteraciones}</td>
                        <td className="px-3 py-2 text-center">{o.cantidad_imagenes > 0 ? `📎 ${o.cantidad_imagenes}` : '—'}</td>
                        <td className="px-3 py-2 text-gray-600">
                          {o.miembros.length > 0 ? o.miembros.map((m) => m.iniciales).join('/') : '—'}
                        </td>
                        <td className="px-3 py-2 text-gray-400 whitespace-nowrap">{formatFecha(o.created_at)}</td>
                      </tr>
                    ))}
                    {filtradas.length === 0 && (
                      <tr>
                        <td colSpan={8} className="text-center text-gray-400 py-8">
                          Ninguna observación coincide con los filtros.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </main>

      {detalleId != null && (
        <Modal titulo="Detalle de Observación" onClose={() => setDetalleId(null)} ancho="max-w-2xl">
          <DetalleObservacion
            observacionId={detalleId}
            miembrosProyecto={miembrosProyecto}
            onVolver={() => setDetalleId(null)}
            onCambio={cargar}
          />
        </Modal>
      )}
    </div>
  );
}
