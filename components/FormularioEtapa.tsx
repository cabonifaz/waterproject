// components/FormularioEtapa.tsx
// A diferencia de módulo/épica, la etapa necesita un campo extra: si es
// LA etapa de Desarrollo (única por proyecto, habilita módulos/épicas/HU)
// o una etapa simple (solo tareas matrices).

'use client';

import { useState } from 'react';

interface Props {
  proyectoId: number;
  yaExisteDesarrollo: boolean;
  onSuccess: () => void;
}

const inputClass =
  'w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500';
const labelClass = 'block text-sm font-medium text-gray-700 mb-1';

const FormularioEtapa = ({ proyectoId, yaExisteDesarrollo, onSuccess }: Props) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nombre, setNombre] = useState('');
  const [esDesarrollo, setEsDesarrollo] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/etapas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proyecto_id: proyectoId,
          nombre,
          tipo: esDesarrollo ? 'desarrollo' : 'simple',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al crear la etapa');
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
        <label className={labelClass}>Nombre de la etapa *</label>
        <input
          type="text"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          required
          autoFocus
          className={inputClass}
        />
      </div>

      <div>
        <label className="flex items-start gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={esDesarrollo}
            disabled={yaExisteDesarrollo}
            onChange={(e) => setEsDesarrollo(e.target.checked)}
            className="mt-1"
          />
          <span>
            Es la etapa de <strong>Desarrollo</strong> (tiene módulos → épicas → historias de usuario)
            {yaExisteDesarrollo && (
              <span className="block text-xs text-gray-400 mt-1">
                Este proyecto ya tiene una etapa de Desarrollo — las demás son etapas simples con tareas matrices.
              </span>
            )}
          </span>
        </label>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 font-semibold transition-colors"
      >
        {loading ? '⏳ Creando...' : '✓ Crear Etapa'}
      </button>
    </form>
  );
};

export default FormularioEtapa;
