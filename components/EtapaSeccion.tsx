// components/EtapaSeccion.tsx

'use client';

import { useState } from 'react';
import Modal from './Modal';
import FormularioNombreSimple from './FormularioNombreSimple';
import FormularioTareaMatriz from './FormularioTareaMatriz';
import ModuloSeccion from './ModuloSeccion';
import SelectorMiembros from './SelectorMiembros';
import BotonesOrden from './BotonesOrden';
import { CasillaActividad, CasillaGrupo, claveTarea } from './SeleccionActividades';
import { EtapaConContenido, Miembro, TareaMatrizConDias } from '@/types';
import { diasPlanificadosEtapa, calcularPorcentaje, contarDias } from '@/lib/planificacion';
import { fechasHito, fechaCierreEfectiva, formatFechaCorta } from '@/lib/hitos';

interface Props {
  etapa: EtapaConContenido;
  miembrosProyecto: Miembro[];
  totalGeneral: number;
  onRefrescar: () => void;
}

const sufijoDiasPorcentaje = (dias: number, total: number) => {
  const porcentaje = calcularPorcentaje(dias, total);
  return ` (${dias} día${dias === 1 ? '' : 's'}${porcentaje != null ? ` · ${porcentaje}%` : ''})`;
};

const EtapaSeccion = ({ etapa, miembrosProyecto, totalGeneral, onRefrescar }: Props) => {
  const diasEtapa = diasPlanificadosEtapa(etapa);
  const [expandido, setExpandido] = useState(true);
  const [mostrarFormTarea, setMostrarFormTarea] = useState(false);
  const [mostrarFormModulo, setMostrarFormModulo] = useState(false);
  const [editandoTarea, setEditandoTarea] = useState<TareaMatrizConDias | null>(null);
  const idsTareas = etapa.tareasMatrices.map((t) => t.id);
  const idsModulos = etapa.modulos.map((m) => m.id);
  const [desactivando, setDesactivando] = useState(false);

  // Desactivar (no borra): ej. la etapa "Cierre" cuando cada módulo ya
  // tiene su propio cierre. Se reactiva desde "Etapas desactivadas".
  const handleDesactivar = async () => {
    if (
      !confirm(
        `¿Desactivar la etapa "${etapa.nombre}"?\n\nDeja de verse en la estructura, los Gantt, los Excel y los reportes, pero no se borra nada: se puede reactivar tal cual desde "Etapas desactivadas", al final de la página.`
      )
    ) {
      return;
    }
    setDesactivando(true);
    try {
      const res = await fetch(`/api/etapas/${etapa.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activa: false }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'No se pudo desactivar la etapa');
      onRefrescar();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'No se pudo desactivar la etapa');
    } finally {
      setDesactivando(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow mb-4 overflow-hidden">
      <button
        onClick={() => setExpandido((v) => !v)}
        className="w-full flex justify-between items-center px-4 py-2.5 bg-blue-950"
      >
        <h2 className="text-sm font-bold text-white">
          {expandido ? '▼' : '▶'} {etapa.nombre}
          <span className="font-normal text-blue-200">{sufijoDiasPorcentaje(diasEtapa, totalGeneral)}</span>
          {etapa.tipo === 'desarrollo' && (
            <span className="ml-2 text-[10px] align-middle px-2 py-0.5 bg-white/20 text-white rounded-full font-semibold uppercase">
              Desarrollo
            </span>
          )}
        </h2>
        <span className="text-xs text-blue-100">
          {etapa.tipo === 'desarrollo'
            ? `${etapa.modulos.length} módulo(s)`
            : `${etapa.tareasMatrices.length} tarea(s) matriz`}
        </span>
      </button>

      {expandido && (
        <div className="p-4">
          <div className="flex gap-2 mb-3">
            {etapa.tipo === 'simple' && (
              <button
                onClick={() => setMostrarFormTarea(true)}
                className="text-xs px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg font-semibold text-gray-700"
              >
                ➕ Tarea Matriz
              </button>
            )}
            {etapa.tipo === 'desarrollo' && (
              <button
                onClick={() => setMostrarFormModulo(true)}
                className="text-xs px-3 py-1.5 bg-indigo-100 hover:bg-indigo-200 rounded-lg font-semibold text-indigo-700"
              >
                ➕ Módulo
              </button>
            )}
            {etapa.tipo === 'simple' && (
              <button
                onClick={handleDesactivar}
                disabled={desactivando}
                title="Ocultar esta etapa sin borrarla (ej. el Cierre del proyecto si cada módulo tiene su cierre)"
                className="ml-auto text-xs px-3 py-1.5 border border-red-200 text-red-600 hover:bg-red-50 rounded-lg font-semibold disabled:opacity-50"
              >
                {desactivando ? '...' : '🗑️ Desactivar etapa'}
              </button>
            )}
          </div>

          {etapa.tareasMatrices.length > 0 && (
            <div className="bg-white border rounded-lg overflow-hidden mb-3">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="px-1 py-2 w-10 text-left">
                      <CasillaGrupo
                        claves={idsTareas.map(claveTarea)}
                        titulo="Seleccionar todas las tareas de la etapa (para asignar talentos)"
                      />
                    </th>
                    <th className="px-2 py-2 text-center font-semibold w-10" title="Hitos: fechas comprometidas (planificadas)">
                      H
                    </th>
                    <th className="px-3 py-2 text-left font-semibold">Título</th>
                    <th className="px-3 py-2 text-center font-semibold">Días (Gantt)</th>
                    <th className="px-3 py-2 text-center font-semibold">Miembros</th>
                    <th className="px-3 py-2 text-center font-semibold" title="Según el hito del Gantt REAL">
                      Estado
                    </th>
                    <th className="px-2 py-2 w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {etapa.tareasMatrices.map((t, i) => {
                    const diasTrabajo = contarDias(t.diasPlanificados); // incluye los días de hito
                    // H planificado = fecha(s) comprometida(s); el estado
                    // "Cerrada" sale solo del hito del Gantt REAL.
                    const hitos = fechasHito(t.diasPlanificados);
                    const cierreReal = fechaCierreEfectiva(t.diasReales);
                    return (
                      <tr key={t.id} className="border-b last:border-b-0">
                        <td className="px-1 py-2">
                          <div className="flex items-center gap-1.5">
                            <CasillaActividad clave={claveTarea(t.id)} />
                            <BotonesOrden tipo="tarea_matriz" ids={idsTareas} indice={i} onMovido={onRefrescar} />
                          </div>
                        </td>
                        <td className="px-2 py-2 text-center">
                          {hitos.length > 0 && (
                            <span
                              title={`Fecha${hitos.length > 1 ? 's' : ''} comprometida${hitos.length > 1 ? 's' : ''}: ${hitos
                                .map(formatFechaCorta)
                                .join(', ')}`}
                              className="inline-flex items-center justify-center min-w-[20px] h-5 px-1 bg-blue-700 text-white text-[10px] font-bold rounded cursor-help"
                            >
                              H{hitos.length > 1 ? `×${hitos.length}` : ''}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 font-medium text-gray-900">
                          {t.titulo}
                          <span className="font-normal text-gray-400">
                            {sufijoDiasPorcentaje(diasTrabajo, totalGeneral)}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-center">{diasTrabajo}</td>
                        <td className="px-3 py-2 text-center">
                          <SelectorMiembros
                            endpoint={`/api/tareas-matrices/${t.id}/miembros`}
                            miembrosProyecto={miembrosProyecto}
                            miembrosAsignados={t.miembros}
                            onRefrescar={onRefrescar}
                          />
                        </td>
                        <td className="px-3 py-2 text-center">
                          {cierreReal ? (
                            <span
                              title={`Hito real: ${formatFechaCorta(cierreReal)}`}
                              className="text-green-700 font-semibold"
                            >
                              ✓ Cerrada
                            </span>
                          ) : (
                            <span className="text-gray-400">Pendiente</span>
                          )}
                        </td>
                        <td className="px-2 py-2 text-center">
                          <button
                            onClick={() => setEditandoTarea(t)}
                            title="Editar tarea matriz"
                            className="text-gray-500 hover:text-gray-800"
                          >
                            ✏️
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {etapa.modulos.map((modulo, i) => (
            <ModuloSeccion
              key={modulo.id}
              modulo={modulo}
              miembrosProyecto={miembrosProyecto}
              totalGeneral={totalGeneral}
              idsHermanos={idsModulos}
              indice={i}
              onRefrescar={onRefrescar}
            />
          ))}

          {etapa.tareasMatrices.length === 0 && etapa.modulos.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">
              {etapa.tipo === 'desarrollo'
                ? 'Sin módulos todavía — agregá uno para empezar a cargar épicas / funcionalidades.'
                : 'Sin tareas matrices todavía.'}
            </p>
          )}
        </div>
      )}

      {mostrarFormTarea && (
        <Modal titulo="Nueva Tarea Matriz" onClose={() => setMostrarFormTarea(false)}>
          <FormularioTareaMatriz
            etapaId={etapa.id}
            miembrosProyecto={miembrosProyecto}
            onSuccess={() => {
              setMostrarFormTarea(false);
              onRefrescar();
            }}
          />
        </Modal>
      )}

      {editandoTarea && (
        <Modal titulo="Editar Tarea Matriz" onClose={() => setEditandoTarea(null)}>
          <FormularioTareaMatriz
            tarea={editandoTarea}
            miembrosProyecto={miembrosProyecto}
            miembrosAsignados={editandoTarea.miembros}
            onSuccess={() => {
              setEditandoTarea(null);
              onRefrescar();
            }}
          />
        </Modal>
      )}

      {mostrarFormModulo && (
        <Modal titulo="Nuevo Módulo" onClose={() => setMostrarFormModulo(false)}>
          <FormularioNombreSimple
            endpoint="/api/modulos"
            parentField="etapa_id"
            parentId={etapa.id}
            labelNombre="Nombre del módulo"
            onSuccess={() => {
              setMostrarFormModulo(false);
              onRefrescar();
            }}
          />
        </Modal>
      )}
    </div>
  );
};

export default EtapaSeccion;
