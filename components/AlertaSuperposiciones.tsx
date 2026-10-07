// components/AlertaSuperposiciones.tsx
// Aviso (solo informativo) de superposición de talentos en un Gantt: una
// persona con más de una actividad marcada el mismo día. "Ver detalle"
// abre el listado por persona y día.

'use client';

import { useMemo, useState } from 'react';
import Modal from './Modal';
import { Miembro } from '@/types';
import { detectarSuperposiciones, FilaConTalentos } from '@/lib/superposiciones';
import { formatFechaCorta } from '@/lib/hitos';

interface Props {
  filas: FilaConTalentos[];
  marcas: Map<string, string>;
  // Para el texto: "planificado" o "real".
  contexto: string;
}

const nombreMiembro = (m: Miembro) => `${m.iniciales} — ${m.nombre}`;

const AlertaSuperposiciones = ({ filas, marcas, contexto }: Props) => {
  const [abierto, setAbierto] = useState(false);
  const superposiciones = useMemo(() => detectarSuperposiciones(filas, marcas), [filas, marcas]);

  if (superposiciones.length === 0) return null;
  const totalDias = superposiciones.reduce((acc, s) => acc + s.dias.length, 0);

  return (
    <>
      <div className="mb-4 bg-amber-50 border border-amber-300 text-amber-900 px-4 py-2 rounded-lg text-sm flex items-center justify-between gap-3 flex-wrap">
        <span>
          ⚠️ <strong>Superposición de talentos ({contexto}):</strong>{' '}
          {superposiciones.length === 1 ? '1 persona tiene' : `${superposiciones.length} personas tienen`} más de una
          actividad el mismo día ({totalDias} día{totalDias === 1 ? '' : 's'} en total) —{' '}
          {superposiciones.map((s) => s.miembro.iniciales).join(', ')}.
        </span>
        <button
          onClick={() => setAbierto(true)}
          className="px-3 py-1 rounded-lg border border-amber-400 bg-white text-amber-900 font-semibold hover:bg-amber-100 flex-shrink-0"
        >
          Ver detalle
        </button>
      </div>

      {abierto && (
        <Modal titulo="⚠️ Superposición de talentos" onClose={() => setAbierto(false)} ancho="max-w-2xl">
          <div className="space-y-5 text-sm">
            <p className="text-gray-500">
              Días en que una misma persona tiene más de una actividad marcada en el {contexto}. Es solo un aviso:
              podés dejarlo así o reasignar / mover días.
            </p>
            {superposiciones.map((s) => (
              <div key={s.miembro.id}>
                <h3 className="font-bold text-gray-900 mb-1">
                  {nombreMiembro(s.miembro)}{' '}
                  <span className="font-normal text-gray-500">
                    ({s.dias.length} día{s.dias.length === 1 ? '' : 's'})
                  </span>
                </h3>
                <table className="w-full text-xs border-collapse">
                  <tbody>
                    {s.dias.map((d) => (
                      <tr key={d.fecha} className="border-b last:border-b-0 align-top">
                        <td className="py-1 pr-3 whitespace-nowrap font-semibold text-amber-800 w-24">
                          {formatFechaCorta(d.fecha)}
                        </td>
                        <td className="py-1 text-gray-700">{d.actividades.join(' · ')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        </Modal>
      )}
    </>
  );
};

export default AlertaSuperposiciones;
