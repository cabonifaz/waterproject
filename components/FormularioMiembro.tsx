// components/FormularioMiembro.tsx
// Agrega una persona al proyecto: nombre + iniciales (ej. "Luis Ramírez" /
// "LR"). Las iniciales son lo que se muestra en las tablas de actividades.

'use client';

import { useState } from 'react';

interface Props {
  proyectoId: number;
  onSuccess: () => void;
}

const inputClass =
  'w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500';
const labelClass = 'block text-sm font-medium text-gray-700 mb-1';

const FormularioMiembro = ({ proyectoId, onSuccess }: Props) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nombre, setNombre] = useState('');
  const [iniciales, setIniciales] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/proyectos/${proyectoId}/miembros`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre, iniciales }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al agregar el miembro');
      setNombre('');
      setIniciales('');
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
        <label className={labelClass}>Nombre completo *</label>
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
        <label className={labelClass}>Iniciales *</label>
        <input
          type="text"
          value={iniciales}
          onChange={(e) => setIniciales(e.target.value.toUpperCase())}
          maxLength={10}
          required
          placeholder="Ej. LR"
          className={inputClass}
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 font-semibold transition-colors"
      >
        {loading ? '⏳ Agregando...' : '✓ Agregar Miembro'}
      </button>
    </form>
  );
};

export default FormularioMiembro;
