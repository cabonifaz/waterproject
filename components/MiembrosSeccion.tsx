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
  const [cambiandoCross, setCambiandoCross] = useState<number | null>(null);

  // "Cross": el talento trabaja a propósito en varias funcionalidades a la
  // vez (arquitecto, QA, líder técnico...) — no genera alertas de superposición.
  const handleCross = async (m: Miembro) => {
    setCambiandoCross(m.id);
    try {
      await fetch(`/api/miembros/${m.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ es_cross: !m.es_cross }),
      });
      onRefrescar();
    } finally {
      setCambiandoCross(null);
    }
  };

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
          Estas iniciales son las que se muestran en la columna &quot;Miembros&quot; de cada actividad. Marcá como{' '}
          <strong>Cross</strong> a quien trabaja en varias funcionalidades a la vez (no le genera alertas de
          superposición).
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
                onClick={() => handleCross(m)}
                disabled={cambiandoCross === m.id}
                title={
                  m.es_cross
                    ? 'Talento cross: no genera alertas de superposición. Click para quitar.'
                    : 'Marcar como talento cross (trabaja en varias funcionalidades a la vez, no genera alertas de superposición)'
                }
                className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border disabled:opacity-50 ${
                  m.es_cross
                    ? 'bg-violet-600 border-violet-600 text-white'
                    : 'border-slate-300 text-slate-400 hover:border-violet-400 hover:text-violet-600'
                }`}
              >
                Cross
              </button>
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
