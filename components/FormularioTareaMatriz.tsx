// components/FormularioTareaMatriz.tsx
// No pide días ni responsable: eso se define después en el Gantt
// planificado (marcando los días de trabajo/cierre).

'use client';

import { useState } from 'react';

interface Props {
  etapaId: number;
  onSuccess: () => void;
}

const inputClass =
  'w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500';
const labelClass = 'block text-sm font-medium text-gray-700 mb-1';

const FormularioTareaMatriz = ({ etapaId, onSuccess }: Props) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    titulo: '',
    descripcion: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/tareas-matrices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          etapa_id: etapaId,
          titulo: formData.titulo,
          descripcion: formData.descripcion || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al crear la tarea matriz');
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

      <div>
        <label className={labelClass}>Título *</label>
        <input
          type="text"
          name="titulo"
          value={formData.titulo}
          onChange={handleChange}
          required
          autoFocus
          className={inputClass}
        />
      </div>

      <div>
        <label className={labelClass}>Descripción</label>
        <textarea
          name="descripcion"
          value={formData.descripcion}
          onChange={handleChange}
          rows={2}
          className={inputClass}
        />
      </div>

      <p className="text-xs text-gray-400">
        Los días de trabajo y el cierre se marcan después en el Gantt planificado.
      </p>

      <button
        type="submit"
        disabled={loading}
        className="w-full px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 font-semibold transition-colors"
      >
        {loading ? '⏳ Creando...' : '✓ Crear Tarea Matriz'}
      </button>
    </form>
  );
};

export default FormularioTareaMatriz;
