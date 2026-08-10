// components/SprintsSeccion.tsx
// Franja con la línea de tiempo de sprints (plantilla global, compartida
// por todos los proyectos — son las columnas del Gantt) + botón para
// generar más.

'use client';

import { useState } from 'react';
import Modal from './Modal';
import FormularioSprints from './FormularioSprints';
import { Sprint } from '@/types';

interface Props {
  sprints: Sprint[];
  onRefrescar: () => void;
}

const formatFecha = (fecha: Date) =>
  new Date(fecha).toLocaleDateString('es', { day: '2-digit', month: '2-digit', year: '2-digit' });

const SprintsSeccion = ({ sprints, onRefrescar }: Props) => {
  const [mostrarForm, setMostrarForm] = useState(false);
  const lista = sprints || [];
  const siguienteNumero = (lista[lista.length - 1]?.numero || 0) + 1;
  const mostrarPriorizacion = !lista.some((s) => s.tipo === 'priorizacion');

  return (
    <div className="bg-white rounded-lg shadow p-4 mb-6">
      <div className="flex justify-between items-center mb-3">
        <h2 className="font-bold text-gray-900">🗓️ Sprints</h2>
        <button
          onClick={() => setMostrarForm(true)}
          className="text-xs px-3 py-1.5 bg-blue-100 hover:bg-blue-200 rounded-lg font-semibold text-blue-700"
        >
          ➕ Generar Sprints
        </button>
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
              className={`flex-shrink-0 border rounded-lg px-3 py-2 text-center min-w-[110px] ${
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

      {mostrarForm && (
        <Modal titulo="Generar Sprints" onClose={() => setMostrarForm(false)}>
          <FormularioSprints
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
