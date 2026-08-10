// components/ModalEliminarProyecto.tsx
// Confirmación reforzada: hay que escribir el nombre exacto del proyecto
// para habilitar el botón, porque esto borra TODO (etapas, módulos,
// épicas, HU, tareas matrices, sprints y todo lo marcado en el Gantt) sin
// vuelta atrás.

'use client';

import { useState } from 'react';
import Modal from './Modal';

interface Props {
  proyectoId: number;
  nombreProyecto: string;
  onClose: () => void;
  onEliminado: () => void;
}

const ModalEliminarProyecto = ({ proyectoId, nombreProyecto, onClose, onEliminado }: Props) => {
  const [confirmacion, setConfirmacion] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const habilitado = confirmacion.trim() === nombreProyecto;

  const handleEliminar = async () => {
    if (!habilitado) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/proyectos/${proyectoId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al eliminar el proyecto');
      onEliminado();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal titulo="⚠️ Eliminar proyecto completo" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-gray-700">
          Esto borra <strong>todo</strong> el proyecto <strong>&quot;{nombreProyecto}&quot;</strong>: etapas,
          módulos, épicas, historias de usuario, tareas matrices, sprints y todo lo marcado en el Gantt. No se
          puede deshacer.
        </p>

        {error && <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded text-sm">{error}</div>}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Escribí <strong>{nombreProyecto}</strong> para confirmar
          </label>
          <input
            type="text"
            value={confirmacion}
            onChange={(e) => setConfirmacion(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
            autoFocus
          />
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-semibold transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleEliminar}
            disabled={!habilitado || loading}
            className="flex-1 px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-semibold transition-colors"
          >
            {loading ? '⏳ Eliminando...' : '🗑️ Eliminar todo'}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default ModalEliminarProyecto;
