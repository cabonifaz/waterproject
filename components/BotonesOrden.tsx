// components/BotonesOrden.tsx
// Par de flechitas ▲▼ para reordenar un elemento entre sus hermanos.

'use client';

import { useState } from 'react';
import { moverElemento, TipoReordenable } from '@/lib/reordenar';

interface Props {
  tipo: TipoReordenable;
  ids: number[]; // hermanos, en el orden actual
  indice: number;
  onMovido: () => void;
  className?: string;
}

const BotonesOrden = ({ tipo, ids, indice, onMovido, className = '' }: Props) => {
  const [moviendo, setMoviendo] = useState(false);

  const mover = async (delta: -1 | 1) => {
    setMoviendo(true);
    try {
      await moverElemento(tipo, ids, indice, delta);
      onMovido();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'No se pudo reordenar');
    } finally {
      setMoviendo(false);
    }
  };

  const clase = 'leading-none px-0.5 disabled:opacity-25 disabled:cursor-default hover:text-gray-900';
  return (
    <span className={`inline-flex flex-col text-[9px] text-gray-500 ${className}`}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          mover(-1);
        }}
        disabled={moviendo || indice === 0}
        title="Subir"
        className={clase}
      >
        ▲
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          mover(1);
        }}
        disabled={moviendo || indice === ids.length - 1}
        title="Bajar"
        className={clase}
      >
        ▼
      </button>
    </span>
  );
};

export default BotonesOrden;
