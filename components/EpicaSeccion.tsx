// components/EpicaSeccion.tsx

'use client';

import { useState } from 'react';
import Modal from './Modal';
import FormularioHistoriaUsuario from './FormularioHistoriaUsuario';
import SelectorMiembros from './SelectorMiembros';
import { EpicaConHU, Miembro } from '@/types';
import { diasPlanificadosEpica, calcularPorcentaje } from '@/lib/planificacion';

interface Props {
  epica: EpicaConHU;
  miembrosProyecto: Miembro[];
  totalGeneral: number;
  onRefrescar: () => void;
}

const getPrioridadColor = (prioridad: string) => {
  switch (prioridad) {
    case 'alta':
      return 'text-red-600 font-semibold';
    case 'baja':
      return 'text-green-600';
    default:
      return 'text-yellow-600';
  }
};

const formatFechaCorta = (fecha: string) =>
  new Date(fecha.slice(0, 10) + 'T00:00:00').toLocaleDateString('es', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

const EpicaSeccion = ({ epica, miembrosProyecto, totalGeneral, onRefrescar }: Props) => {
  const [mostrarForm, setMostrarForm] = useState(false);
  const [cerrando, setCerrando] = useState<number | null>(null);
  const diasEpica = diasPlanificadosEpica(epica);
  const porcentajeEpica = calcularPorcentaje(diasEpica, totalGeneral);

  const handleCerrar = async (id: number) => {
    setCerrando(id);
    try {
      await fetch(`/api/historias-usuario/${id}/cerrar`, { method: 'PATCH' });
      onRefrescar();
    } finally {
      setCerrando(null);
    }
  };

  return (
    <div className="ml-4 mt-3 rounded-lg overflow-hidden border border-blue-200">
      <div className="flex justify-between items-center px-3 py-1.5 bg-blue-100">
        <h4 className="font-semibold text-blue-900 text-xs">
          🎯 {epica.nombre}
          <span className="font-normal text-blue-700">
            {' '}
            ({diasEpica} día{diasEpica === 1 ? '' : 's'}
            {porcentajeEpica != null ? ` · ${porcentajeEpica}%` : ''})
          </span>
        </h4>
        <button
          onClick={() => setMostrarForm(true)}
          className="text-xs text-blue-700 hover:text-blue-900 font-semibold"
        >
          ➕ Historia de Usuario
        </button>
      </div>

      {epica.historias.length > 0 && (
        <div className="bg-white overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="px-2 py-2 text-center font-semibold w-8"></th>
                <th className="px-3 py-2 text-left font-semibold">Código</th>
                <th className="px-3 py-2 text-left font-semibold">Título</th>
                <th className="px-3 py-2 text-center font-semibold">Prioridad</th>
                <th className="px-3 py-2 text-center font-semibold">Días Dev (Gantt)</th>
                <th className="px-3 py-2 text-center font-semibold">Días Cert. (Gantt)</th>
                <th className="px-3 py-2 text-center font-semibold">Miembros</th>
                <th className="px-3 py-2 text-center font-semibold">Estado</th>
              </tr>
            </thead>
            <tbody>
              {epica.historias.map((h) => {
                const diasDev = h.diasPlanificados.filter((d) => d.tipo_marca === 'desarrollo').length;
                const diasCert = h.diasPlanificados.filter((d) => d.tipo_marca === 'certificacion').length;
                const marcaCierre = h.diasPlanificados.find((d) => d.tipo_marca === 'cierre');
                return (
                  <tr key={h.id} className="border-b last:border-b-0">
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
                    <td className="px-3 py-2 font-mono text-gray-500">{h.codigo || '—'}</td>
                    <td className="px-3 py-2 font-medium text-gray-900">{h.titulo}</td>
                    <td className={`px-3 py-2 text-center ${getPrioridadColor(h.prioridad)}`}>{h.prioridad}</td>
                    <td className="px-3 py-2 text-center">{diasDev}</td>
                    <td className="px-3 py-2 text-center">{diasCert}</td>
                    <td className="px-3 py-2 text-center">
                      <SelectorMiembros
                        endpoint={`/api/historias-usuario/${h.id}/miembros`}
                        miembrosProyecto={miembrosProyecto}
                        miembrosAsignados={h.miembros}
                        onRefrescar={onRefrescar}
                      />
                    </td>
                    <td className="px-3 py-2 text-center">
                      {h.cerrada ? (
                        <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full font-semibold">
                          ✓ Cerrada
                        </span>
                      ) : (
                        <button
                          onClick={() => handleCerrar(h.id)}
                          disabled={cerrando === h.id}
                          className="text-blue-600 hover:text-blue-800 font-semibold disabled:opacity-50"
                        >
                          {cerrando === h.id ? '...' : 'Cerrar'}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {mostrarForm && (
        <Modal titulo="Nueva Historia de Usuario" onClose={() => setMostrarForm(false)}>
          <FormularioHistoriaUsuario
            epicaId={epica.id}
            onSuccess={() => {
              setMostrarForm(false);
              onRefrescar();
            }}
          />
        </Modal>
      )}
    </div>
  );
};

export default EpicaSeccion;
