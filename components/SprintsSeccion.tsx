// components/SprintsSeccion.tsx
// Franja con la línea de tiempo de sprints del PI (compartida por todos
// los proyectos de ese PI — son las columnas del Gantt) + botón para
// generar más.

'use client';

import { useState } from 'react';
import Modal from './Modal';
import FormularioSprints from './FormularioSprints';
import EditarSprintsModal from './EditarSprintsModal';
import { Sprint } from '@/types';

interface Props {
  piId: number;
  sprints: Sprint[];
  onRefrescar: () => void;
}

const formatFecha = (fecha: Date) =>
  new Date(fecha).toLocaleDateString('es', { day: '2-digit', month: '2-digit', year: '2-digit' });

const SprintsSeccion = ({ piId, sprints, onRefrescar }: Props) => {
  const [mostrarForm, setMostrarForm] = useState(false);
  const [mostrarEditar, setMostrarEditar] = useState(false);
  const lista = sprints || [];
  const siguienteNumero = (lista[lista.length - 1]?.numero || 0) + 1;
  const mostrarPriorizacion = !lista.some((s) => s.tipo === 'priorizacion');

  return (
    <div className="bg-white rounded-lg shadow p-4 mb-6">
      <div className="flex justify-between items-center mb-3">
        <h2 className="font-bold text-gray-900">🗓️ Sprints</h2>
        <div className="flex gap-2">
          {lista.length > 0 && (
            <button
              onClick={() => setMostrarEditar(true)}
              className="text-xs px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg font-semibold text-slate-700"
            >
              ✏️ Editar fechas
            </button>
          )}
          <button
            onClick={() => setMostrarForm(true)}
            className="text-xs px-3 py-1.5 bg-blue-100 hover:bg-blue-200 rounded-lg font-semibold text-blue-700"
          >
            ➕ Generar Sprints
          </button>
        </div>
      </div>

      {lista.length === 0 ? (
        <p className="text-sm text-gray-400">
          Sin sprints todavía. Generalos para definir la línea de tiempo del Gantt.
        </p>
      ) : (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {lista.map((s) => (
            <div
              key={s.id}
              onClick={() => setMostrarEditar(true)}
              title="Editar fechas"
              className={`flex-shrink-0 border rounded-lg px-3 py-2 text-center min-w-[110px] cursor-pointer hover:border-blue-400 ${
                s.tipo === 'priorizacion' ? 'bg-gray-200 border-gray-300' : 'bg-slate-50 border-slate-200'
              }`}
            >
              <p className="text-xs font-bold text-slate-700">
                {s.tipo === 'priorizacion' ? 'Priorización' : `Sprint ${s.numero}`}
              </p>
              <p className="text-[11px] text-slate-500 mt-1">
                {formatFecha(s.fecha_inicio)} – {formatFecha(s.fecha_fin)}
              </p>
            </div>
          ))}
        </div>
      )}

      {mostrarEditar && (
        <EditarSprintsModal piId={piId} sprints={lista} onClose={() => setMostrarEditar(false)} onCambio={onRefrescar} />
      )}

      {mostrarForm && (
        <Modal titulo="Generar Sprints" onClose={() => setMostrarForm(false)}>
          <FormularioSprints
            piId={piId}
            siguienteNumero={siguienteNumero}
            mostrarPriorizacion={mostrarPriorizacion}
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

export default SprintsSeccion;
