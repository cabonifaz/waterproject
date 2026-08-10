// components/FormularioSprints.tsx
// Genera varios sprints consecutivos de una vez: fecha de inicio + duración
// en días + cantidad. Estas fechas van a definir las columnas del Gantt.

'use client';

import { useState } from 'react';

interface Props {
  siguienteNumero: number;
  mostrarPriorizacion: boolean;
  onSuccess: () => void;
}

const inputClass =
  'w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500';
const labelClass = 'block text-sm font-medium text-gray-700 mb-1';

const FormularioSprints = ({ siguienteNumero, mostrarPriorizacion, onSuccess }: Props) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fechaInicio, setFechaInicio] = useState(new Date().toISOString().split('T')[0]);
  const [diasDuracion, setDiasDuracion] = useState('14');
  const [cantidad, setCantidad] = useState('4');
  const [diasPriorizacion, setDiasPriorizacion] = useState('6');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/sprints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fecha_inicio: fechaInicio,
          dias_duracion: parseInt(diasDuracion, 10) || 14,
          cantidad: parseInt(cantidad, 10) || 1,
          dias_priorizacion: mostrarPriorizacion ? parseInt(diasPriorizacion, 10) || 0 : 0,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al generar los sprints');
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded">{error}</div>}

      <p className="text-sm text-gray-500">
        Se van a generar a partir de <strong>Sprint {siguienteNumero}</strong>, consecutivos y sin superponerse.
      </p>

      <div>
        <label className={labelClass}>
          {mostrarPriorizacion ? 'Fecha de inicio de Priorización *' : 'Fecha de inicio del primer sprint *'}
        </label>
        <input
          type="date"
          value={fechaInicio}
          onChange={(e) => setFechaInicio(e.target.value)}
          required
          className={inputClass}
        />
      </div>

      {mostrarPriorizacion && (
        <div>
          <label className={labelClass}>Días de Priorización (Zona Gris, antes de Sprint 1)</label>
          <input
            type="number"
            min={0}
            value={diasPriorizacion}
            onChange={(e) => setDiasPriorizacion(e.target.value)}
            className={inputClass}
          />
          <p className="text-xs text-gray-400 mt-1">0 si no querés generar esta etapa.</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Duración (días) *</label>
          <input
            type="number"
            min={1}
            value={diasDuracion}
            onChange={(e) => setDiasDuracion(e.target.value)}
            required
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Cantidad de sprints *</label>
          <input
            type="number"
            min={1}
            value={cantidad}
            onChange={(e) => setCantidad(e.target.value)}
            required
            className={inputClass}
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 font-semibold transition-colors"
      >
        {loading ? '⏳ Generando...' : '✓ Generar Sprints'}
      </button>
    </form>
  );
};

export default FormularioSprints;
