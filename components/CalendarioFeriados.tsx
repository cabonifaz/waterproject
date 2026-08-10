// components/CalendarioFeriados.tsx
// Calendario mensual clickeable: click en un día lo marca/desmarca como
// feriado (toggle). La forma más simple y visual de cargar feriados —
// sin formularios, un click por día.

'use client';

import { useMemo, useState } from 'react';
import { Feriado } from '@/types';

interface Props {
  feriados: Feriado[];
  onToggleDia: (fechaISO: string) => void;
}

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];
const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

const formatISO = (y: number, m: number, d: number) =>
  `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

const hoyISO = () => {
  const hoy = new Date();
  return formatISO(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
};

const CalendarioFeriados = ({ feriados, onToggleDia }: Props) => {
  const hoy = new Date();
  const [anio, setAnio] = useState(hoy.getFullYear());
  const [mes, setMes] = useState(hoy.getMonth()); // 0-11

  const feriadosSet = useMemo(
    () => new Set((feriados || []).map((f) => String(f.fecha).slice(0, 10))),
    [feriados]
  );

  const celdas = useMemo(() => {
    const primerDia = new Date(Date.UTC(anio, mes, 1));
    const diaSemanaISO = (primerDia.getUTCDay() + 6) % 7; // 0=lunes ... 6=domingo
    const diasEnMes = new Date(Date.UTC(anio, mes + 1, 0)).getUTCDate();

    const lista: { fecha: string; dia: number; finde: boolean }[] = [];
    for (let i = 0; i < diaSemanaISO; i++) lista.push(null as any);
    for (let d = 1; d <= diasEnMes; d++) {
      const dow = new Date(Date.UTC(anio, mes, d)).getUTCDay();
      lista.push({ fecha: formatISO(anio, mes, d), dia: d, finde: dow === 0 || dow === 6 });
    }
    return lista;
  }, [anio, mes]);

  const cambiarMes = (delta: number) => {
    let nuevoMes = mes + delta;
    let nuevoAnio = anio;
    if (nuevoMes < 0) {
      nuevoMes = 11;
      nuevoAnio -= 1;
    } else if (nuevoMes > 11) {
      nuevoMes = 0;
      nuevoAnio += 1;
    }
    setMes(nuevoMes);
    setAnio(nuevoAnio);
  };

  const hoyIso = hoyISO();

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="flex justify-between items-center mb-4">
        <button
          onClick={() => cambiarMes(-1)}
          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-600 font-bold"
        >
          ‹
        </button>
        <h3 className="font-bold text-gray-900">
          {MESES[mes]} {anio}
        </h3>
        <button
          onClick={() => cambiarMes(1)}
          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-600 font-bold"
        >
          ›
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-1">
        {DIAS_SEMANA.map((d) => (
          <div key={d} className="text-center text-[11px] font-semibold text-gray-400 py-1">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {celdas.map((c, i) => {
          if (!c) return <div key={`vacio-${i}`} />;
          const esFeriado = feriadosSet.has(c.fecha);
          const esHoy = c.fecha === hoyIso;
          return (
            <button
              key={c.fecha}
              onClick={() => onToggleDia(c.fecha)}
              title={esFeriado ? 'Feriado — click para quitar' : 'Click para marcar como feriado'}
              className={[
                'aspect-square rounded-lg text-sm font-medium transition-colors flex items-center justify-center',
                esFeriado
                  ? 'bg-red-500 text-white hover:bg-red-600'
                  : c.finde
                  ? 'bg-gray-100 text-gray-400 hover:bg-red-100'
                  : 'bg-slate-50 text-gray-700 hover:bg-red-100',
                esHoy && !esFeriado ? 'ring-2 ring-blue-400' : '',
              ].join(' ')}
            >
              {c.dia}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-4 mt-4 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-red-500 inline-block" /> Feriado
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-gray-100 inline-block" /> Fin de semana
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded ring-2 ring-blue-400 inline-block" /> Hoy
        </span>
      </div>
    </div>
  );
};

export default CalendarioFeriados;
