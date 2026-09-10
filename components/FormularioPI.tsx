// components/FormularioPI.tsx
// Alta / edición de un Programa Incremental (PI): nombre + fecha de inicio
// (opcional) + estado. En alta no se muestra el estado (nace 'activo').

'use client';

import { useState } from 'react';
import { ProgramaIncremental } from '@/types';

interface Props {
  pi?: ProgramaIncremental;
  onSuccess: (id: number) => void;
}

const inputClass =
  'w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500';
const labelClass = 'block text-sm font-medium text-gray-700 mb-1';

const FormularioPI = ({ pi, onSuccess }: Props) => {
  const editando = !!pi;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nombre, setNombre] = useState(pi?.nombre ?? '');
  const [fechaInicio, setFechaInicio] = useState(
    pi?.fecha_inicio ? String(pi.fecha_inicio).slice(0, 10) : ''
  );
  const [estado, setEstado] = useState<'activo' | 'cerrado'>(pi?.estado ?? 'activo');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(editando ? `/api/pis/${pi!.id}` : '/api/pis', {
        method: editando ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre, fecha_inicio: fechaInicio || null, estado }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al guardar el PI');
      onSuccess(editando ? pi!.id : data.data.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded">{error}</div>}

      <div>
        <label className={labelClass}>Nombre *</label>
        <input
          type="text"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          required
          autoFocus
          placeholder="PI 2025.1"
          className={inputClass}
        />
      </div>

      <div>
        <label className={labelClass}>Fecha de inicio</label>
        <input
          type="date"
          value={fechaInicio}
          onChange={(e) => setFechaInicio(e.target.value)}
          className={inputClass}
        />
      </div>

      {editando && (
        <div>
          <label className={labelClass}>Estado</label>
          <select
            value={estado}
            onChange={(e) => setEstado(e.target.value as 'activo' | 'cerrado')}
            className={inputClass}
          >
            <option value="activo">Activo</option>
            <option value="cerrado">Cerrado</option>
          </select>
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 font-semibold transition-colors"
      >
        {loading ? '⏳ Guardando...' : editando ? '✓ Guardar' : '✓ Crear PI'}
      </button>
    </form>
  );
};

export default FormularioPI;
