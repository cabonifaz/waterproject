// components/MiembrosSeccion.tsx
// Lista de personas del proyecto (nombre + iniciales) con alta y baja.
// Estas iniciales son las que después se asignan a cada HU/tarea matriz
// desde SelectorMiembros.

'use client';

import { useState } from 'react';
import Modal from './Modal';
import FormularioMiembro from './FormularioMiembro';
import { Miembro } from '@/types';

interface Props {
  proyectoId: number;
  miembros: Miembro[];
  onRefrescar: () => void;
}

const MiembrosSeccion = ({ proyectoId, miembros, onRefrescar }: Props) => {
  const [mostrarForm, setMostrarForm] = useState(false);
  const [eliminando, setEliminando] = useState<number | null>(null);

  const handleEliminar = async (id: number) => {
    setEliminando(id);
    try {
      await fetch(`/api/miembros/${id}`, { method: 'DELETE' });
      onRefrescar();
    } finally {
      setEliminando(null);
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <p className="text-sm text-gray-500">
          Estas iniciales son las que se muestran en la columna &quot;Miembros&quot; de cada actividad.
        </p>
        <button
          onClick={() => setMostrarForm(true)}
          className="text-xs px-3 py-1.5 bg-blue-100 hover:bg-blue-200 rounded-lg font-semibold text-blue-700 flex-shrink-0 ml-3"
        >
          ➕ Miembro
        </button>
      </div>

      {miembros.length === 0 ? (
        <p className="text-sm text-gray-400">Sin miembros todavía.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {miembros.map((m) => (
            <div
              key={m.id}
              className="flex items-center gap-2 bg-slate-100 border border-slate-200 rounded-full pl-3 pr-2 py-1"
            >
              <span className="text-xs font-bold text-slate-700">{m.iniciales}</span>
              <span className="text-xs text-slate-500">{m.nombre}</span>
              <button
                onClick={() => handleEliminar(m.id)}
                disabled={eliminando === m.id}
                title="Eliminar miembro"
                className="w-4 h-4 flex items-center justify-center rounded-full text-slate-400 hover:bg-red-100 hover:text-red-600 disabled:opacity-50"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {mostrarForm && (
        <Modal titulo="Nuevo Miembro" onClose={() => setMostrarForm(false)}>
          <FormularioMiembro
            proyectoId={proyectoId}
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

export default MiembrosSeccion;
