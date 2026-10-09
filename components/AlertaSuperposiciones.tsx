// components/AlertaSuperposiciones.tsx
// Aviso (solo informativo) de superposición de talentos en un Gantt: un
// desarrollador con HU de distintas funcionalidades el mismo día (reglas
// en lib/superposiciones.ts). "Ver detalle"
// abre el listado por pares de actividades en conflicto (lo que hay que
// mover o reasignar) o por persona; cada actividad lleva a su fila del
// Gantt. "Solo superpuestas" deja en el Gantt únicamente esas actividades.

'use client';

import { useState } from 'react';
import Modal from './Modal';
import { Miembro } from '@/types';
import { ActividadRef, AnalisisSuperposiciones } from '@/lib/superposiciones';
import { formatFechaCorta } from '@/lib/hitos';

interface Props {
  analisis: AnalisisSuperposiciones;
  // Para el texto: "planificado" o "real".
  contexto: string;
  soloSuperpuestas: boolean;
  onToggleSoloSuperpuestas: () => void;
  // Lleva a la fila de la actividad en el Gantt ("tipo-id").
  onIrAActividad: (clave: string) => void;
}

type Vista = 'actividades' | 'personas';

const nombreMiembro = (m: Miembro) => `${m.iniciales} — ${m.nombre}`;

// "12/10, 13/10, 14/10" — con muchas fechas se resume para no ocupar media pantalla.
function listaFechas(fechas: string[]): string {
  const cortas = fechas.map((f) => formatFechaCorta(f).slice(0, 5));
  return cortas.length > 8 ? `${cortas.slice(0, 8).join(', ')} … (+${cortas.length - 8})` : cortas.join(', ');
}

const AlertaSuperposiciones = ({ analisis, contexto, soloSuperpuestas, onToggleSoloSuperpuestas, onIrAActividad }: Props) => {
  const [abierto, setAbierto] = useState(false);
  const [vista, setVista] = useState<Vista>('actividades');

  if (analisis.porMiembro.length === 0) return null;
  const { porMiembro, conflictos, totalDias } = analisis;

  const irA = (clave: string) => {
    setAbierto(false);
    onIrAActividad(clave);
  };
  const linkActividad = (act: ActividadRef) => (
    <button
      onClick={() => irA(act.clave)}
      title="Ir a esta actividad en el Gantt"
      className="text-left text-blue-700 hover:text-blue-900 hover:underline font-medium"
    >
      {act.etiqueta}
    </button>
  );

  return (
    <>
      <div className="mb-4 bg-amber-50 border border-amber-300 text-amber-900 px-4 py-2 rounded-lg text-sm flex items-center justify-between gap-3 flex-wrap">
        <span>
          ⚠️ <strong>Superposición de talentos ({contexto}):</strong>{' '}
          {porMiembro.length === 1 ? '1 desarrollador tiene' : `${porMiembro.length} desarrolladores tienen`} historias
          de distintas funcionalidades el mismo día ({totalDias} día{totalDias === 1 ? '' : 's'} en total, {conflictos.length} par
          {conflictos.length === 1 ? '' : 'es'} de actividades) — {porMiembro.map((s) => s.miembro.iniciales).join(', ')}.
          Las celdas en conflicto se ven con borde rojo.
        </span>
        <span className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={onToggleSoloSuperpuestas}
            className={`px-3 py-1 rounded-lg border font-semibold ${
              soloSuperpuestas
                ? 'border-red-600 bg-red-600 text-white hover:bg-red-700'
                : 'border-amber-400 bg-white text-amber-900 hover:bg-amber-100'
            }`}
          >
            {soloSuperpuestas ? 'Ver todas las actividades' : 'Solo superpuestas'}
          </button>
          <button
            onClick={() => setAbierto(true)}
            className="px-3 py-1 rounded-lg border border-amber-400 bg-white text-amber-900 font-semibold hover:bg-amber-100"
          >
            Ver detalle
          </button>
        </span>
      </div>

      {abierto && (
        <Modal titulo="⚠️ Superposición de talentos" onClose={() => setAbierto(false)} ancho="max-w-3xl">
          <div className="space-y-4 text-sm">
            <p className="text-gray-500">
              Días en que un mismo desarrollador tiene historias de usuario de funcionalidades distintas marcadas en
              el {contexto}. No cuentan las HU de una misma funcionalidad, ni las tareas matrices ni las actividades
              de cierre (Certificación, Desarrollo Seguro, Aprobación de Champions…). Es solo un aviso: podés dejarlo
              así, reasignar o mover días. Tocá una actividad para ir a su fila en el Gantt.
            </p>
            <div className="flex gap-2">
              {(
                [
                  ['actividades', `Por actividades (${conflictos.length})`],
                  ['personas', `Por persona (${porMiembro.length})`],
                ] as [Vista, string][]
              ).map(([valor, label]) => (
                <button
                  key={valor}
                  onClick={() => setVista(valor)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border-2 ${
                    vista === valor ? 'bg-amber-500 border-amber-500 text-white' : 'border-gray-200 text-gray-600'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {vista === 'actividades' ? (
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="text-left text-gray-500 border-b">
                    <th className="py-1 pr-2">Actividades en conflicto</th>
                    <th className="py-1 pr-2 whitespace-nowrap">Quién</th>
                    <th className="py-1">Días</th>
                  </tr>
                </thead>
                <tbody>
                  {conflictos.map((c) => (
                    <tr key={`${c.a.clave}|${c.b.clave}`} className="border-b last:border-b-0 align-top">
                      <td className="py-1.5 pr-2">
                        {linkActividad(c.a)}
                        <span className="text-gray-400"> ↔ </span>
                        {linkActividad(c.b)}
                      </td>
                      <td className="py-1.5 pr-2 font-semibold text-gray-700 whitespace-nowrap">{c.miembros.join(', ')}</td>
                      <td className="py-1.5 text-amber-800">
                        <strong>{c.fechas.length}</strong> día{c.fechas.length === 1 ? '' : 's'}: {listaFechas(c.fechas)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              porMiembro.map((s) => (
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
                          <td className="py-1 text-gray-700">
                            {d.actividades.map((act, i) => (
                              <span key={act.clave}>
                                {i > 0 && <span className="text-gray-400"> · </span>}
                                {linkActividad(act)}
                              </span>
                            ))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))
            )}
          </div>
        </Modal>
      )}
    </>
  );
};

export default AlertaSuperposiciones;
