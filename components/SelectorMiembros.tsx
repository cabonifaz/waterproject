// components/SelectorMiembros.tsx
// Celda de "Miembros" de una fila de actividad (HU o tarea matriz):
// muestra las iniciales ya asignadas y, al hacer click, abre un selector
// con toggle-pills de todos los miembros del proyecto para asignar o
// desasignar (multi-selección, ej. "LR/HB").

'use client';

import { useState } from 'react';
import Modal from './Modal';
import { Miembro } from '@/types';

interface Props {
  endpoint: string;
  miembrosProyecto: Miembro[];
  miembrosAsignados: Miembro[];
  onRefrescar: () => void;
}

const SelectorMiembros = ({ endpoint, miembrosProyecto, miembrosAsignados, onRefrescar }: Props) => {
  const [mostrarSelector, setMostrarSelector] = useState(false);
  const [guardando, setGuardando] = useState<number | null>(null);
  const asignadosIds = new Set(miembrosAsignados.map((m) => m.id));

  const toggleMiembro = async (miembroId: number) => {
    setGuardando(miembroId);
    try {
      await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ miembro_id: miembroId }),
      });
      onRefrescar();
    } finally {
      setGuardando(null);
    }
  };

  return (
    <>
      <button
        onClick={() => setMostrarSelector(true)}
        className="text-xs font-semibold text-slate-600 hover:text-blue-700 hover:underline min-w-[24px]"
        title="Asignar miembros"
      >
        {miembrosAsignados.length > 0 ? miembrosAsignados.map((m) => m.iniciales).join('/') : '➕'}
      </button>

      {mostrarSelector && (
        <Modal titulo="Asignar Miembros" onClose={() => setMostrarSelector(false)}>
          {miembrosProyecto.length === 0 ? (
            <p className="text-sm text-gray-400">
              Este proyecto todavía no tiene miembros cargados — agregalos primero desde &quot;👥 Miembros&quot;.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {miembrosProyecto.map((m) => {
                const asignado = asignadosIds.has(m.id);
                return (
                  <button
                    key={m.id}
                    onClick={() => toggleMiembro(m.id)}
                    disabled={guardando === m.id}
                    className={`px-3 py-1.5 rounded-full text-sm font-semibold border-2 transition-colors disabled:opacity-50 ${
                      asignado
                        ? 'bg-blue-600 text-white border-transparent'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    {m.iniciales} · {m.nombre}
                  </button>
                );
              })}
            </div>
          )}
        </Modal>
      )}
    </>
  );
};

export default SelectorMiembros;
