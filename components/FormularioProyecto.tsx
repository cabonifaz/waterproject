// components/FormularioProyecto.tsx

'use client';

import { useState } from 'react';
import ListaNombresEditable from './ListaNombresEditable';

interface Props {
  piId: number;
  celulaId: number | null;
  onSuccess: (id: number) => void;
}

const inputClass =
  'w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500';
const labelClass = 'block text-sm font-medium text-gray-700 mb-1';

const FormularioProyecto = ({ piId, celulaId, onSuccess }: Props) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [fechaInicio, setFechaInicio] = useState(new Date().toISOString().split('T')[0]);
  const [usarPlantilla, setUsarPlantilla] = useState(true);
  const [autoActividadesCierre, setAutoActividadesCierre] = useState(false);
  const [actividadesCierre, setActividadesCierre] = useState<string[]>([]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const nombresCierre = actividadesCierre.map((n) => n.trim()).filter(Boolean);
    if (autoActividadesCierre && nombresCierre.length === 0) {
      setError('Agregá al menos una actividad de cierre, o desmarcá la opción.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/proyectos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre,
          descripcion,
          fecha_inicio: fechaInicio,
          usarPlantilla,
          pi_id: piId,
          celula_id: celulaId,
          auto_actividades_cierre: autoActividadesCierre,
          actividades_cierre: autoActividadesCierre ? nombresCierre : [],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al crear el proyecto');
      onSuccess(data.data.id);
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
          className={inputClass}
        />
      </div>

      <div>
        <label className={labelClass}>Descripción</label>
        <textarea
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          rows={3}
          className={inputClass}
        />
      </div>

      <div>
        <label className={labelClass}>Fecha de inicio *</label>
        <input
          type="date"
          value={fechaInicio}
          onChange={(e) => setFechaInicio(e.target.value)}
          required
          className={inputClass}
        />
      </div>

      <div>
        <label className="flex items-start gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={usarPlantilla}
            onChange={(e) => setUsarPlantilla(e.target.checked)}
            className="mt-1"
          />
          <span>
            Usar plantilla estándar
            <span className="block text-xs text-gray-400 mt-1">
              Crea automáticamente las etapas Análisis y Diseño, Desarrollo Seguro, Implementación y Cierre, con sus
              tareas matrices típicas. Queda todo editable después.
            </span>
          </span>
        </label>
      </div>

      <div>
        <label className="flex items-start gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={autoActividadesCierre}
            onChange={(e) => setAutoActividadesCierre(e.target.checked)}
            className="mt-1"
          />
          <span>
            Crear actividades de cierre en cada funcionalidad
            <span className="block text-xs text-gray-400 mt-1">
              Cada épica / funcionalidad nueva va a nacer con estas actividades obligatorias al final. Después se
              pueden corregir, reordenar o ampliar desde la estructura del proyecto.
            </span>
          </span>
        </label>
        {autoActividadesCierre && (
          <div className="mt-2 ml-6">
            <ListaNombresEditable valores={actividadesCierre} onChange={setActividadesCierre} />
          </div>
        )}
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 font-semibold transition-colors"
      >
        {loading ? '⏳ Creando...' : '✓ Crear Proyecto'}
      </button>
    </form>
  );
};

export default FormularioProyecto;
