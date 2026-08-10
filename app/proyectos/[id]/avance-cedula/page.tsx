// app/proyectos/[id]/avance-cedula/page.tsx
// Reporte "Avance Célula": real vs. planificado vs. baseline, generado a
// pedido. Se recalcula en vivo cada vez que se abre la página; recién
// queda guardado como histórico ("foto") cuando el usuario confirma
// "Cerrar Corte de Hoy" — así se puede comparar cuánto se avanzó desde el
// corte anterior sin perder esa referencia.

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import Modal from '@/components/Modal';
import { EstructuraProyecto, CorteAvance, DetalleCorteAvance, FilaAvanceCedula } from '@/types';
import { construirFilasAvanceCedula, calcularFilasConPorcentajes, Semaforo } from '@/lib/avanceCedula';

interface Historico {
  hoy: string;
  corteHoy: CorteAvance | null;
  detalleHoy: DetalleCorteAvance[];
  corteAnterior: CorteAvance | null;
  detalleAnterior: DetalleCorteAvance[];
}

const SEMAFORO_ICONO: Record<Semaforo, string> = {
  verde: '🟢',
  amarillo: '🟡',
  rojo: '🔴',
  negro: '⚫',
};

function formatPct(v: number | null): string {
  return v == null ? '—' : `${v}%`;
}

function formatFecha(fecha: string): string {
  return new Date(fecha.slice(0, 10) + 'T00:00:00').toLocaleDateString('es', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

// El detalle guardado en un corte usa la misma forma que FilaAvanceCedula
// (solo cambia el naming snake_case de la DB) — se reusa exactamente la
// misma función de cálculo de porcentajes que la vista en vivo.
function detalleAFilas(detalle: DetalleCorteAvance[]): FilaAvanceCedula[] {
  return detalle.map((d) => ({
    tipo: d.tipo,
    referenciaId: d.referencia_id,
    etapaNombre: d.etapa_nombre,
    nombre: d.nombre,
    esEncabezadoEtapa: d.tipo === 'etapa',
    diasTotales: d.dias_totales,
    diasPlanificados: d.dias_planificados,
    diasReales: d.dias_reales,
  }));
}

function claveFila(tipo: string, referenciaId: number): string {
  return `${tipo}-${referenciaId}`;
}

export default function AvanceCedulaPage() {
  const params = useParams();
  const proyectoId = parseInt(params.id as string, 10);

  const [estructura, setEstructura] = useState<EstructuraProyecto | null>(null);
  const [historico, setHistorico] = useState<Historico | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sidebarAbierto, setSidebarAbierto] = useState(true);
  const [mostrarConfirmacion, setMostrarConfirmacion] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    try {
      setLoading(true);
      const [resEst, resHist] = await Promise.all([
        fetch(`/api/proyectos/${proyectoId}/estructura`),
        fetch(`/api/proyectos/${proyectoId}/avance-cedula/historico`),
      ]);
      if (!resEst.ok) throw new Error('Error al obtener la estructura del proyecto');
      if (!resHist.ok) throw new Error('Error al obtener el histórico de cortes');
      const dataEst = await resEst.json();
      const dataHist = await resHist.json();
      setEstructura(dataEst.data);
      setHistorico(dataHist.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  }, [proyectoId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const filasVivoCrudas = useMemo(() => (estructura ? construirFilasAvanceCedula(estructura) : []), [estructura]);
  const { filas, totales } = useMemo(() => calcularFilasConPorcentajes(filasVivoCrudas), [filasVivoCrudas]);

  const avanceRealAnteriorPorFila = useMemo(() => {
    const mapa = new Map<string, number | null>();
    if (!historico?.detalleAnterior?.length) return mapa;
    const { filas: filasAnterior } = calcularFilasConPorcentajes(detalleAFilas(historico.detalleAnterior));
    for (const f of filasAnterior) {
      mapa.set(claveFila(f.tipo, f.referenciaId), f.porcentajeAvanceReal);
    }
    return mapa;
  }, [historico]);

  const totalAvanceRealAnterior = useMemo(() => {
    if (!historico?.detalleAnterior?.length) return null;
    const { totales: totalesAnterior } = calcularFilasConPorcentajes(detalleAFilas(historico.detalleAnterior));
    return totalesAnterior.porcentajeAvanceReal;
  }, [historico]);

  const handleCerrarCorte = async () => {
    setGuardando(true);
    try {
      const res = await fetch(`/api/proyectos/${proyectoId}/avance-cedula/cerrar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filas: filasVivoCrudas }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al guardar el corte');
      setMostrarConfirmacion(false);
      await cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar el corte');
    } finally {
      setGuardando(false);
    }
  };

  const renderDelta = (actual: number | null, referenciaClave?: string) => {
    if (!historico?.corteAnterior) return <span className="text-gray-300">—</span>;
    const anterior = referenciaClave ? avanceRealAnteriorPorFila.get(referenciaClave) ?? 0 : totalAvanceRealAnterior;
    if (actual == null || anterior == null) return <span className="text-gray-300">—</span>;
    const delta = Math.round((actual - anterior) * 10) / 10;
    const color = delta > 0 ? 'text-green-700' : delta < 0 ? 'text-red-600' : 'text-gray-400';
    return (
      <span className={`font-semibold ${color}`}>
        {delta > 0 ? '+' : ''}
        {delta}%
      </span>
    );
  };

  const sinBaseline = estructura && !estructura.proyecto.baseline_capturado;

  return (
    <div className="flex h-screen bg-gray-50">
      {sidebarAbierto && <Sidebar />}

      <main className="flex-1 overflow-auto">
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
                <h1 className="text-2xl font-bold text-gray-900">📋 Avance Célula</h1>
                {estructura && <p className="text-gray-600 text-sm mt-1">{estructura.proyecto.nombre}</p>}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <a
                href={`/proyectos/${proyectoId}/gantt-real`}
                className="px-4 py-2 rounded-lg text-sm font-semibold bg-white border-2 border-slate-300 text-slate-700 hover:bg-slate-50"
              >
                🎯 Ir al Real
              </a>
              <a href={`/proyectos/${proyectoId}`} className="text-sm text-blue-600 hover:text-blue-800 font-semibold">
                ← Volver a la estructura
              </a>
            </div>
          </div>

          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm">
              {error}
            </div>
          )}

          {loading && <div className="animate-pulse h-32 bg-gray-200 rounded" />}

          {!loading && sinBaseline && (
            <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
              Este reporte necesita el planificado inicial (baseline).{' '}
              <a href={`/proyectos/${proyectoId}/gantt`} className="text-blue-600 hover:text-blue-800 font-semibold">
                Cerrá el planificado por lo menos una vez
              </a>{' '}
              para habilitarlo.
            </div>
          )}

          {!loading && estructura && !sinBaseline && historico && (
            <>
              <div className="mb-4 bg-white rounded-lg shadow px-4 py-3 flex items-center justify-between flex-wrap gap-3">
                <div className="text-sm text-gray-600">
                  {historico.corteHoy ? (
                    <>
                      ✅ Ya hay un corte guardado hoy ({formatFecha(historico.hoy)}). Esta tabla es la{' '}
                      <strong>vista en vivo actual</strong> — si cambiaste algo en el real, volvé a cerrar para
                      actualizar el corte guardado.
                    </>
                  ) : (
                    <>
                      🔍 Vista previa en vivo del corte de <strong>hoy ({formatFecha(historico.hoy)})</strong> —
                      todavía no se guardó.
                    </>
                  )}
                  {historico.corteAnterior && (
                    <span className="block text-gray-400 mt-1">
                      Comparando contra el corte anterior del {formatFecha(historico.corteAnterior.fecha_corte)}.
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setMostrarConfirmacion(true)}
                  className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold transition-colors flex-shrink-0"
                >
                  {historico.corteHoy ? '🔄 Actualizar Corte de Hoy' : '🔒 Cerrar Corte de Hoy'}
                </button>
              </div>

              <div className="flex gap-4">
                <div className="flex-1 bg-white rounded-lg shadow overflow-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-blue-950 text-white">
                        <th className="px-2 py-2 text-center font-semibold border">Nro.</th>
                        <th className="px-3 py-2 text-left font-semibold border">Tareas</th>
                        <th className="px-2 py-2 text-center font-semibold border">% de Fase</th>
                        <th className="px-2 py-2 text-center font-semibold border">Días Totales</th>
                        <th className="px-2 py-2 text-center font-semibold border">Días Planificados</th>
                        <th className="px-2 py-2 text-center font-semibold border">Días Reales</th>
                        <th className="px-2 py-2 text-center font-semibold border">% Planificado</th>
                        <th className="px-2 py-2 text-center font-semibold border">% Real</th>
                        <th className="px-2 py-2 text-center font-semibold border">% Cumplimiento</th>
                        <th className="px-2 py-2 text-center font-semibold border">Semáforo</th>
                        <th className="px-2 py-2 text-center font-semibold border">% Avance Planificado</th>
                        <th className="px-2 py-2 text-center font-semibold border">% Avance Real</th>
                        <th className="px-2 py-2 text-center font-semibold border">Δ vs. corte anterior</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filas.map((f, i) => {
                        const clave = claveFila(f.tipo, f.referenciaId);
                        if (f.esEncabezadoEtapa) {
                          return (
                            <tr key={`${clave}-${i}`} className="bg-blue-900 text-white font-semibold">
                              <td className="px-2 py-1.5 text-center border">{i + 1}</td>
                              <td className="px-3 py-1.5 border">{f.nombre}</td>
                              <td className="px-2 py-1.5 text-center border">{formatPct(f.porcentajeFase)}</td>
                              <td className="px-2 py-1.5 text-center border">{f.diasTotales}</td>
                              <td className="px-2 py-1.5 text-center border">{f.diasPlanificados}</td>
                              <td className="px-2 py-1.5 text-center border">{f.diasReales}</td>
                              <td className="px-2 py-1.5 text-center border">{formatPct(f.porcentajePlanificado)}</td>
                              <td className="px-2 py-1.5 text-center border">{formatPct(f.porcentajeReal)}</td>
                              <td className="px-2 py-1.5 text-center border">{formatPct(f.porcentajeCumplimiento)}</td>
                              <td className="px-2 py-1.5 text-center border text-base">{SEMAFORO_ICONO[f.semaforo]}</td>
                              <td className="px-2 py-1.5 text-center border">
                                {formatPct(f.porcentajeAvancePlanificado)}
                              </td>
                              <td className="px-2 py-1.5 text-center border">{formatPct(f.porcentajeAvanceReal)}</td>
                              <td className="px-2 py-1.5 text-center border bg-white text-gray-900">
                                {renderDelta(f.porcentajeAvanceReal, clave)}
                              </td>
                            </tr>
                          );
                        }
                        return (
                          <tr
                            key={`${clave}-${i}`}
                            className={f.tipo === 'epica' ? 'bg-blue-50' : 'bg-amber-50'}
                          >
                            <td className="px-2 py-1.5 text-center border">{i + 1}</td>
                            <td className="px-3 py-1.5 border text-gray-800">{f.nombre}</td>
                            <td className="px-2 py-1.5 text-center border">{formatPct(f.porcentajeFase)}</td>
                            <td className="px-2 py-1.5 text-center border">{f.diasTotales}</td>
                            <td className="px-2 py-1.5 text-center border">{f.diasPlanificados}</td>
                            <td className="px-2 py-1.5 text-center border">{f.diasReales}</td>
                            <td className="px-2 py-1.5 text-center border">{formatPct(f.porcentajePlanificado)}</td>
                            <td className="px-2 py-1.5 text-center border">{formatPct(f.porcentajeReal)}</td>
                            <td className="px-2 py-1.5 text-center border">{formatPct(f.porcentajeCumplimiento)}</td>
                            <td className="px-2 py-1.5 text-center border text-base">{SEMAFORO_ICONO[f.semaforo]}</td>
                            <td className="px-2 py-1.5 text-center border">{formatPct(f.porcentajeAvancePlanificado)}</td>
                            <td className="px-2 py-1.5 text-center border">{formatPct(f.porcentajeAvanceReal)}</td>
                            <td className="px-2 py-1.5 text-center border">{renderDelta(f.porcentajeAvanceReal, clave)}</td>
                          </tr>
                        );
                      })}
                      {filas.length === 0 && (
                        <tr>
                          <td colSpan={13} className="text-center text-gray-400 py-8">
                            Sin actividades todavía.
                          </td>
                        </tr>
                      )}
                    </tbody>
                    <tfoot>
                      <tr className="bg-blue-950 text-white font-bold">
                        <td className="px-2 py-2 border" colSpan={2}>
                          {totales.nombre}
                        </td>
                        <td className="px-2 py-2 text-center border">{formatPct(totales.porcentajeFase)}</td>
                        <td className="px-2 py-2 text-center border">{totales.diasTotales}</td>
                        <td className="px-2 py-2 text-center border">{totales.diasPlanificados}</td>
                        <td className="px-2 py-2 text-center border">{totales.diasReales}</td>
                        <td className="px-2 py-2 text-center border">{formatPct(totales.porcentajePlanificado)}</td>
                        <td className="px-2 py-2 text-center border">{formatPct(totales.porcentajeReal)}</td>
                        <td className="px-2 py-2 text-center border bg-green-700">
                          {formatPct(totales.porcentajeCumplimiento)}
                        </td>
                        <td className="px-2 py-2 text-center border text-base">
                          {SEMAFORO_ICONO[totales.semaforo]}
                        </td>
                        <td className="px-2 py-2 text-center border bg-green-700">
                          {formatPct(totales.porcentajeAvancePlanificado)}
                        </td>
                        <td className="px-2 py-2 text-center border bg-green-700">
                          {formatPct(totales.porcentajeAvanceReal)}
                        </td>
                        <td className="px-2 py-2 text-center border bg-white text-gray-900">
                          {renderDelta(totales.porcentajeAvanceReal)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                <div className="w-56 flex-shrink-0 bg-white rounded-lg shadow p-4 h-fit">
                  <h3 className="font-bold text-gray-900 text-sm mb-3">Desviación de Cronograma</h3>
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-4 h-4 rounded bg-green-500 inline-block flex-shrink-0" />
                      <span>Desviación ≤ 5%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-4 h-4 rounded bg-yellow-400 inline-block flex-shrink-0" />
                      <span>Desviación &gt; 5% y ≤ 8%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-4 h-4 rounded bg-red-500 inline-block flex-shrink-0" />
                      <span>Desviación &gt; 8%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-4 h-4 rounded bg-gray-700 inline-block flex-shrink-0" />
                      <span>Todavía no arrancó</span>
                    </div>
                  </div>
                  <p className="text-[11px] text-gray-400 mt-3">
                    Desviación = 100% − % Cumplimiento (Días Reales / Días Planificados).
                  </p>
                </div>
              </div>
            </>
          )}
        </div>
      </main>

      {mostrarConfirmacion && historico && (
        <Modal titulo="Confirmar cierre de corte" onClose={() => !guardando && setMostrarConfirmacion(false)}>
          <div className="space-y-4">
            <p className="text-sm text-gray-700">
              Vas a guardar el avance de hoy (<strong>{formatFecha(historico.hoy)}</strong>) como un corte
              histórico{historico.corteHoy ? ', reemplazando el que ya estaba guardado para hoy' : ''}. Vas a poder
              seguir editando el Gantt real y volver a cerrar para actualizarlo, hasta que pase el día — el
              próximo corte se va a comparar contra este.
            </p>
            <p className="text-sm font-semibold text-gray-900">
              % Total de Avance Real: {formatPct(totales.porcentajeReal)} · % Cumplimiento:{' '}
              {formatPct(totales.porcentajeCumplimiento)}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setMostrarConfirmacion(false)}
                disabled={guardando}
                className="flex-1 px-4 py-2 border-2 border-gray-200 rounded-lg font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleCerrarCorte}
                disabled={guardando}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold disabled:opacity-50"
              >
                {guardando ? '⏳ Guardando...' : '✓ Confirmar y Guardar'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
