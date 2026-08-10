// components/EtapaSeccion.tsx

'use client';

import { useState } from 'react';
import Modal from './Modal';
import FormularioNombreSimple from './FormularioNombreSimple';
import FormularioTareaMatriz from './FormularioTareaMatriz';
import ModuloSeccion from './ModuloSeccion';
import SelectorMiembros from './SelectorMiembros';
import { EtapaConContenido, Miembro } from '@/types';
import { diasPlanificadosEtapa, calcularPorcentaje } from '@/lib/planificacion';

interface Props {
  etapa: EtapaConContenido;
  miembrosProyecto: Miembro[];
  totalGeneral: number;
  onRefrescar: () => void;
}

const formatFechaCorta = (fecha: string) =>
  new Date(fecha.slice(0, 10) + 'T00:00:00').toLocaleDateString('es', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

const sufijoDiasPorcentaje = (dias: number, total: number) => {
  const porcentaje = calcularPorcentaje(dias, total);
  return ` (${dias} día${dias === 1 ? '' : 's'}${porcentaje != null ? ` · ${porcentaje}%` : ''})`;
};

const EtapaSeccion = ({ etapa, miembrosProyecto, totalGeneral, onRefrescar }: Props) => {
  const diasEtapa = diasPlanificadosEtapa(etapa);
  const [expandido, setExpandido] = useState(true);
  const [mostrarFormTarea, setMostrarFormTarea] = useState(false);
  const [mostrarFormModulo, setMostrarFormModulo] = useState(false);

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
          </div>

          {etapa.tareasMatrices.length > 0 && (
            <div className="bg-white border rounded-lg overflow-hidden mb-3">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="px-2 py-2 text-center font-semibold w-8"></th>
                    <th className="px-3 py-2 text-left font-semibold">Título</th>
                    <th className="px-3 py-2 text-center font-semibold">Días trabajo (Gantt)</th>
                    <th className="px-3 py-2 text-center font-semibold">Miembros</th>
                    <th className="px-3 py-2 text-center font-semibold">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {etapa.tareasMatrices.map((t) => {
                    const diasTrabajo = t.diasPlanificados.filter((d) => d.tipo_marca === 'trabajo').length;
                    const marcaCierre = t.diasPlanificados.find((d) => d.tipo_marca === 'cierre');
                    return (
                      <tr key={t.id} className="border-b last:border-b-0">
                        <td className="px-2 py-2 text-center">
                          {marcaCierre && (
                            <span
                              title={`Fecha planificada: ${formatFechaCorta(marcaCierre.fecha)}`}
                              className="inline-flex items-center justify-center w-5 h-5 bg-blue-700 text-white text-[10px] font-bold rounded cursor-help"
                            >
                              H
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
                          {marcaCierre ? (
                            <span className="text-green-700 font-semibold">✓ Cerrada</span>
                          ) : (
                            <span className="text-gray-400">Pendiente</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {etapa.modulos.map((modulo) => (
            <ModuloSeccion
              key={modulo.id}
              modulo={modulo}
              miembrosProyecto={miembrosProyecto}
              totalGeneral={totalGeneral}
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
            onSuccess={() => {
              setMostrarFormTarea(false);
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
