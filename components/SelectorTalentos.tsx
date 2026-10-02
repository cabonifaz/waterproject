// components/SelectorTalentos.tsx
// Pills de multi-selección de talentos (miembros del proyecto), controlado:
// no guarda nada, solo devuelve la selección. Lo usan el modal de edición
// de HU/tarea matriz y la asignación en grupo.

'use client';

import { Miembro } from '@/types';

interface Props {
  miembrosProyecto: Miembro[];
  seleccionados: number[];
  onChange: (ids: number[]) => void;
}

export async function guardarTalentosLote(datos: {
  huIds: number[];
  tareaIds: number[];
  miembroIds: number[];
  accion: 'agregar' | 'quitar' | 'reemplazar';
}): Promise<void> {
  const res = await fetch('/api/miembros/asignar-lote', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      hu_ids: datos.huIds,
      tarea_ids: datos.tareaIds,
      miembro_ids: datos.miembroIds,
      accion: datos.accion,
    }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'No se pudieron asignar los talentos');
  }
}

const SelectorTalentos = ({ miembrosProyecto, seleccionados, onChange }: Props) => {
  if (miembrosProyecto.length === 0) {
    return (
      <p className="text-sm text-gray-400">
        Este proyecto todavía no tiene talentos cargados — agregalos primero desde &quot;👥 Miembros&quot;.
      </p>
    );
  }
  const set = new Set(seleccionados);
  return (
    <div className="flex flex-wrap gap-2">
      {miembrosProyecto.map((m) => {
        const activo = set.has(m.id);
        return (
          <button
            key={m.id}
            type="button"
            onClick={() => onChange(activo ? seleccionados.filter((id) => id !== m.id) : [...seleccionados, m.id])}
            className={`px-3 py-1.5 rounded-full text-sm font-semibold border-2 transition-colors ${
              activo ? 'bg-blue-600 text-white border-transparent' : 'border-gray-200 text-gray-600 hover:border-gray-300'
            }`}
          >
            {m.iniciales} · {m.nombre}
          </button>
        );
      })}
    </div>
  );
};

export default SelectorTalentos;
