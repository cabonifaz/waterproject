// components/FormularioNombreSimple.tsx
// Formulario genérico para crear Etapa / Módulo / Épica: todas solo piden
// nombre, cambia el endpoint y el campo de padre. Con `valorInicial`
// funciona en modo edición: hace PATCH { nombre } al endpoint.

'use client';

import { useState } from 'react';

interface Props {
  endpoint: string;
  parentField?: string;
  parentId?: number;
  labelNombre: string;
  valorInicial?: string;
  onSuccess: () => void;
}

const inputClass =
  'w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500';
const labelClass = 'block text-sm font-medium text-gray-700 mb-1';

const FormularioNombreSimple = ({ endpoint, parentField, parentId, labelNombre, valorInicial, onSuccess }: Props) => {
  const editando = valorInicial != null;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nombre, setNombre] = useState(valorInicial ?? '');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(endpoint, {
        method: editando ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editando || !parentField ? { nombre } : { [parentField]: parentId, nombre }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || (editando ? 'Error al guardar' : 'Error al crear'));
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
        <label className={labelClass}>{labelNombre} *</label>
        <input
          type="text"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          required
          autoFocus
          className={inputClass}
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="w-full px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 font-semibold transition-colors"
      >
        {loading ? (editando ? '⏳ Guardando...' : '⏳ Creando...') : editando ? '✓ Guardar cambios' : '✓ Crear'}
      </button>
    </form>
  );
};

export default FormularioNombreSimple;
