// components/EpicaSeccion.tsx

'use client';

import { useState } from 'react';
import Modal from './Modal';
import FormularioHistoriaUsuario from './FormularioHistoriaUsuario';
import FormularioNombreSimple from './FormularioNombreSimple';
import SelectorMiembros from './SelectorMiembros';
import BotonesOrden from './BotonesOrden';
import { EpicaConHU, HistoriaUsuario, Miembro } from '@/types';
import { diasPlanificadosEpica, calcularPorcentaje } from '@/lib/planificacion';
import { fechasHito, formatFechaCorta } from '@/lib/hitos';

interface Props {
  epica: EpicaConHU;
  miembrosProyecto: Miembro[];
  totalGeneral: number;
  idsHermanas: number[]; // épicas del módulo, en orden — para ▲▼
  indice: number;
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

const EpicaSeccion = ({ epica, miembrosProyecto, totalGeneral, idsHermanas, indice, onRefrescar }: Props) => {
  const [mostrarForm, setMostrarForm] = useState(false);
  const [editandoEpica, setEditandoEpica] = useState(false);
  const [editandoHU, setEditandoHU] = useState<HistoriaUsuario | null>(null);
  const [cerrando, setCerrando] = useState<number | null>(null);
  const [eliminando, setEliminando] = useState<number | null>(null);
  const [eliminandoEpica, setEliminandoEpica] = useState(false);
  const [expandido, setExpandido] = useState(true);
  const diasEpica = diasPlanificadosEpica(epica);
  const porcentajeEpica = calcularPorcentaje(diasEpica, totalGeneral);

  // Las HU comunes y las actividades de cierre se reordenan cada grupo por
  // separado: las de cierre siempre van al final de la funcionalidad.
  const idsComunes = epica.historias.filter((h) => !h.es_actividad_cierre).map((h) => h.id);
  const idsCierre = epica.historias.filter((h) => h.es_actividad_cierre).map((h) => h.id);

  const handleCerrar = async (id: number) => {
    setCerrando(id);
    try {
      await fetch(`/api/historias-usuario/${id}/cerrar`, { method: 'PATCH' });
      onRefrescar();
    } finally {
      setCerrando(null);
    }
  };

  const handleEliminar = async (id: number, titulo: string) => {
    if (!confirm(`¿Eliminar la historia de usuario "${titulo}"?\n\nNo se borra de forma definitiva: se oculta y se puede recuperar volviendo a subirla en un Excel con el mismo código.`)) {
      return;
    }
    setEliminando(id);
    try {
      await fetch(`/api/historias-usuario/${id}`, { method: 'DELETE' });
      onRefrescar();
    } finally {
      setEliminando(null);
    }
  };

  const handleEliminarEpica = async () => {
    if (
      !confirm(
        `¿Eliminar la épica "${epica.nombre}"?\n\nSe oculta junto con sus historias de usuario. No se borra de forma definitiva: se puede recuperar volviendo a subirla en un Excel con el mismo nombre.`
      )
    ) {
      return;
    }
    setEliminandoEpica(true);
    try {
      await fetch(`/api/epicas/${epica.id}`, { method: 'DELETE' });
      onRefrescar();
    } finally {
      setEliminandoEpica(false);
    }
  };

  return (
    <div className="ml-4 mt-3 rounded-lg overflow-hidden border border-blue-200">
      <div className="flex justify-between items-center px-3 py-1.5 bg-blue-100 gap-2">
        <BotonesOrden tipo="epica" ids={idsHermanas} indice={indice} onMovido={onRefrescar} />
        <button
          onClick={() => setExpandido((v) => !v)}
          className="flex-1 text-left"
        >
          <h4 className="font-semibold text-blue-900 text-xs">
            {expandido ? '▼' : '▶'} 🎯 {epica.nombre}
            <span className="font-normal text-blue-700">
              {' '}
              ({diasEpica} día{diasEpica === 1 ? '' : 's'}
              {porcentajeEpica != null ? ` · ${porcentajeEpica}%` : ''})
            </span>
          </h4>
        </button>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => setMostrarForm(true)}
            className="text-xs text-blue-700 hover:text-blue-900 font-semibold"
          >
            ➕ Historia de Usuario
          </button>
          <button
            onClick={() => setEditandoEpica(true)}
            title="Editar épica / funcionalidad"
            className="text-xs text-blue-700 hover:text-blue-900"
          >
            ✏️
          </button>
          <button
            onClick={handleEliminarEpica}
            disabled={eliminandoEpica}
            title="Eliminar épica"
            className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50"
          >
            {eliminandoEpica ? '...' : '🗑️'}
          </button>
        </div>
      </div>

      {expandido && epica.historias.length > 0 && (
        <div className="bg-white overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="px-1 py-2 w-6"></th>
                <th className="px-2 py-2 text-center font-semibold w-8" title="Hito: fecha comprometida (planificada)">
                  H
                </th>
                <th className="px-3 py-2 text-left font-semibold">Código</th>
                <th className="px-3 py-2 text-left font-semibold">Título</th>
                <th className="px-3 py-2 text-center font-semibold">Prioridad</th>
                <th className="px-3 py-2 text-center font-semibold">Días Dev (Gantt)</th>
                <th className="px-3 py-2 text-center font-semibold">Días Cert. (Gantt)</th>
                <th className="px-3 py-2 text-center font-semibold">Miembros</th>
                <th className="px-3 py-2 text-center font-semibold">Estado</th>
                <th className="px-2 py-2 text-center font-semibold w-14"></th>
              </tr>
            </thead>
            <tbody>
              {epica.historias.map((h) => {
                const diasDev = h.diasPlanificados.filter((d) => d.tipo_marca === 'desarrollo').length;
                const diasCert = h.diasPlanificados.filter((d) => d.tipo_marca === 'certificacion').length;
                const hito = fechasHito(h.diasPlanificados)[0];
                const grupo = h.es_actividad_cierre ? idsCierre : idsComunes;
                return (
                  <tr
                    key={h.id}
                    className={`border-b last:border-b-0 ${h.es_actividad_cierre ? 'bg-amber-50/60' : ''}`}
                  >
                    <td className="px-1 py-2 text-center">
                      <BotonesOrden tipo="hu" ids={grupo} indice={grupo.indexOf(h.id)} onMovido={onRefrescar} />
                    </td>
                    <td className="px-2 py-2 text-center">
                      {hito && (
                        <span
                          title={`Fecha comprometida: ${formatFechaCorta(hito)}`}
                          className="inline-flex items-center justify-center w-5 h-5 bg-blue-700 text-white text-[10px] font-bold rounded cursor-help"
                        >
                          H
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 font-mono text-gray-500">{h.codigo || '—'}</td>
                    <td className="px-3 py-2 font-medium text-gray-900">
                      {h.es_actividad_cierre && (
                        <span
                          title="Actividad de cierre de la funcionalidad"
                          className="mr-1.5 px-1.5 py-0.5 rounded bg-amber-200 text-amber-900 text-[10px] font-bold"
                        >
                          🏁 Cierre
                        </span>
                      )}
                      {h.titulo}
                    </td>
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
                    <td className="px-2 py-2 text-center whitespace-nowrap">
                      <button
                        onClick={() => setEditandoHU(h)}
                        title="Editar historia de usuario"
                        className="text-gray-500 hover:text-gray-800 mr-1.5"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => handleEliminar(h.id, h.titulo)}
                        disabled={eliminando === h.id}
                        title="Eliminar historia de usuario"
                        className="text-red-500 hover:text-red-700 disabled:opacity-50"
                      >
                        {eliminando === h.id ? '...' : '🗑️'}
                      </button>
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

      {editandoHU && (
        <Modal
          titulo={editandoHU.es_actividad_cierre ? 'Editar Actividad de Cierre' : 'Editar Historia de Usuario'}
          onClose={() => setEditandoHU(null)}
        >
          <FormularioHistoriaUsuario
            historia={editandoHU}
            onSuccess={() => {
              setEditandoHU(null);
              onRefrescar();
            }}
          />
        </Modal>
      )}

      {editandoEpica && (
        <Modal titulo="Editar Épica / Funcionalidad" onClose={() => setEditandoEpica(false)}>
          <FormularioNombreSimple
            endpoint={`/api/epicas/${epica.id}`}
            labelNombre="Nombre de la épica / funcionalidad"
            valorInicial={epica.nombre}
            onSuccess={() => {
              setEditandoEpica(false);
              onRefrescar();
            }}
          />
        </Modal>
      )}
    </div>
  );
};

export default EpicaSeccion;
