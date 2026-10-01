// components/EditarSprintsModal.tsx
// Edición de las fechas de los sprints de un PI (son las columnas del
// Gantt de todos sus proyectos). "Desplazar los siguientes" corre los
// sprints posteriores la misma cantidad de días que se movió el fin —
// así se puede ampliar el planificado sin superponer sprints. También
// permite generar sprints nuevos al final.

'use client';

import { useEffect, useState } from 'react';
import Modal from './Modal';
import FormularioSprints from './FormularioSprints';
import { Sprint } from '@/types';

interface Props {
  piId: number;
  sprints: Sprint[];
  onClose: () => void;
  onCambio: () => void;
}

const soloFecha = (f: Date | string) => String(f).slice(0, 10);

const diaSiguiente = (f?: Date | string): string | undefined => {
  if (!f) return undefined;
  const d = new Date(soloFecha(f) + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
};

const EditarSprintsModal = ({ piId, sprints, onClose, onCambio }: Props) => {
  const [fechas, setFechas] = useState<Record<number, { inicio: string; fin: string }>>({});
  const [desplazar, setDesplazar] = useState(true);
  const [guardando, setGuardando] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mostrarGenerar, setMostrarGenerar] = useState(false);

  useEffect(() => {
    setFechas(
      Object.fromEntries(sprints.map((s) => [s.id, { inicio: soloFecha(s.fecha_inicio), fin: soloFecha(s.fecha_fin) }]))
    );
  }, [sprints]);

  const guardar = async (s: Sprint) => {
    const f = fechas[s.id];
    setGuardando(s.id);
    setError(null);
    try {
      const res = await fetch(`/api/sprints/${s.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fecha_inicio: f.inicio, fecha_fin: f.fin, desplazar }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al guardar el sprint');
      onCambio();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setGuardando(null);
    }
  };

  const lista = sprints || [];
  const siguienteNumero = (lista[lista.length - 1]?.numero || 0) + 1;

  return (
    <Modal titulo="🗓️ Fechas de los Sprints" onClose={onClose} ancho="max-w-2xl">
      <div className="space-y-4 text-sm">
        <p className="text-gray-500">
          Los sprints son del PI: los cambios se ven en el Gantt de todos sus proyectos. Para ampliar el planificado,
          alargá el fin del último sprint o generá sprints nuevos.
        </p>

        {error && <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded">{error}</div>}

        <label className="flex items-center gap-2 text-gray-700">
          <input type="checkbox" checked={desplazar} onChange={(e) => setDesplazar(e.target.checked)} />
          Desplazar los sprints siguientes cuando cambia la fecha de fin
        </label>

        <table className="w-full text-xs">
          <thead className="bg-slate-50 border-b">
            <tr>
              <th className="px-2 py-2 text-left">Sprint</th>
              <th className="px-2 py-2 text-left">Inicio</th>
              <th className="px-2 py-2 text-left">Fin</th>
              <th className="px-2 py-2 w-24"></th>
            </tr>
          </thead>
          <tbody>
            {lista.map((s) => {
              const f = fechas[s.id];
              if (!f) return null;
              const cambiado = f.inicio !== soloFecha(s.fecha_inicio) || f.fin !== soloFecha(s.fecha_fin);
              return (
                <tr key={s.id} className={`border-b last:border-b-0 ${cambiado ? 'bg-amber-50' : ''}`}>
                  <td className="px-2 py-1.5 font-semibold text-slate-700">
                    {s.tipo === 'priorizacion' ? 'Priorización' : `Sprint ${s.numero}`}
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      type="date"
                      value={f.inicio}
                      onChange={(e) => setFechas((prev) => ({ ...prev, [s.id]: { ...prev[s.id], inicio: e.target.value } }))}
                      className="px-2 py-1 border border-gray-300 rounded"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      type="date"
                      value={f.fin}
                      onChange={(e) => setFechas((prev) => ({ ...prev, [s.id]: { ...prev[s.id], fin: e.target.value } }))}
                      className="px-2 py-1 border border-gray-300 rounded"
                    />
                  </td>
                  <td className="px-2 py-1.5 text-right">
                    {cambiado && (
                      <button
                        onClick={() => guardar(s)}
                        disabled={guardando != null}
                        className="px-3 py-1 bg-blue-600 text-white rounded font-semibold disabled:opacity-50"
                      >
                        {guardando === s.id ? '...' : 'Guardar'}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="border-t pt-4">
          {!mostrarGenerar ? (
            <button
              onClick={() => setMostrarGenerar(true)}
              className="text-xs px-3 py-1.5 bg-blue-100 hover:bg-blue-200 rounded-lg font-semibold text-blue-700"
            >
              ➕ Generar más sprints
            </button>
          ) : (
            <FormularioSprints
              piId={piId}
              siguienteNumero={siguienteNumero}
              mostrarPriorizacion={!lista.some((s) => s.tipo === 'priorizacion')}
              fechaInicioSugerida={diaSiguiente(lista[lista.length - 1]?.fecha_fin)}
              onSuccess={() => {
                setMostrarGenerar(false);
                onCambio();
              }}
            />
          )}
        </div>
      </div>
    </Modal>
  );
};

export default EditarSprintsModal;
