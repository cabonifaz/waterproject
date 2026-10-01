// components/ListaNombresEditable.tsx
// Lista local de nombres (agregar, corregir, reordenar, quitar). Se usa
// al crear el proyecto para definir las actividades de cierre por
// funcionalidad antes de que existan en la base.

'use client';

import { useState } from 'react';

interface Props {
  valores: string[];
  onChange: (valores: string[]) => void;
  placeholder?: string;
}

const ListaNombresEditable = ({ valores, onChange, placeholder }: Props) => {
  const [nuevo, setNuevo] = useState('');

  const mover = (i: number, delta: -1 | 1) => {
    const j = i + delta;
    if (j < 0 || j >= valores.length) return;
    const copia = [...valores];
    [copia[i], copia[j]] = [copia[j], copia[i]];
    onChange(copia);
  };

  const agregar = () => {
    const nombre = nuevo.trim();
    if (!nombre) return;
    onChange([...valores, nombre]);
    setNuevo('');
  };

  return (
    <div className="space-y-1.5">
      {valores.map((v, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <span className="text-xs text-gray-400 w-4 text-right">{i + 1}.</span>
          <input
            type="text"
            value={v}
            onChange={(e) => onChange(valores.map((x, k) => (k === i ? e.target.value : x)))}
            className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm"
          />
          <button type="button" onClick={() => mover(i, -1)} disabled={i === 0} title="Subir" className="text-xs px-1 disabled:opacity-25">
            ▲
          </button>
          <button
            type="button"
            onClick={() => mover(i, 1)}
            disabled={i === valores.length - 1}
            title="Bajar"
            className="text-xs px-1 disabled:opacity-25"
          >
            ▼
          </button>
          <button
            type="button"
            onClick={() => onChange(valores.filter((_, k) => k !== i))}
            title="Quitar"
            className="text-xs px-1 text-red-500"
          >
            ✕
          </button>
        </div>
      ))}
      <div className="flex items-center gap-1.5">
        <span className="w-4" />
        <input
          type="text"
          value={nuevo}
          onChange={(e) => setNuevo(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              agregar();
            }
          }}
          placeholder={placeholder || 'Nueva actividad...'}
          className="flex-1 px-2 py-1 border border-dashed border-gray-300 rounded text-sm"
        />
        <button type="button" onClick={agregar} className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded font-semibold">
          ➕
        </button>
      </div>
    </div>
  );
};

export default ListaNombresEditable;
