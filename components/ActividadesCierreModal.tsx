// components/ActividadesCierreModal.tsx
// Gestión de las actividades de cierre por funcionalidad de un proyecto
// ya creado: activar/desactivar la auto-creación, corregir nombres
// (se propaga a las ya creadas que mantenían el nombre anterior),
// reordenar (también se propaga), agregar/quitar y completar las
// funcionalidades existentes con las que les falten.

'use client';

import { useCallback, useEffect, useState } from 'react';
import Modal from './Modal';
import BotonesOrden from './BotonesOrden';
import { ActividadCierre } from '@/types';

interface Props {
  proyectoId: number;
  onClose: () => void;
  onCambio: () => void;
}

const ActividadesCierreModal = ({ proyectoId, onClose, onCambio }: Props) => {
  const [auto, setAuto] = useState(false);
  const [actividades, setActividades] = useState<ActividadCierre[]>([]);
  const [nombres, setNombres] = useState<Record<number, string>>({});
  const [nuevo, setNuevo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const cargar = useCallback(async () => {
    const res = await fetch(`/api/proyectos/${proyectoId}/actividades-cierre`);
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || 'Error al cargar actividades de cierre');
      return;
    }
    setAuto(data.data.auto);
    setActividades(data.data.actividades);
    setNombres(Object.fromEntries(data.data.actividades.map((a: ActividadCierre) => [a.id, a.nombre])));
  }, [proyectoId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const ejecutar = async (accion: () => Promise<Response>, mensajeOk?: (data: any) => string) => {
    setOcupado(true);
    setError(null);
    setAviso(null);
    try {
      const res = await accion();
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Error al guardar');
      if (mensajeOk) setAviso(mensajeOk(data));
      await cargar();
      onCambio();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setOcupado(false);
    }
  };

  const json = (method: string, body?: unknown) => ({
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const ids = actividades.map((a) => a.id);

  return (
    <Modal titulo="🏁 Actividades de cierre por funcionalidad" onClose={onClose} ancho="max-w-xl">
      <div className="space-y-4 text-sm">
        <p className="text-gray-500">
          Actividades obligatorias que se crean al final de cada épica / funcionalidad. Corregir un nombre o
          reordenar acá actualiza también las que ya fueron creadas.
        </p>

        {error && <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded">{error}</div>}
        {aviso && <div className="p-3 bg-green-50 border border-green-200 text-green-700 rounded">{aviso}</div>}

        <label className="flex items-center gap-2 font-medium text-gray-700">
          <input
            type="checkbox"
            checked={auto}
            disabled={ocupado || (!auto && actividades.length === 0)}
            onChange={(e) =>
              ejecutar(() => fetch(`/api/proyectos/${proyectoId}/actividades-cierre`, json('PUT', { auto: e.target.checked })))
            }
          />
          Crear automáticamente en cada funcionalidad nueva
        </label>

        <div className="space-y-1.5">
          {actividades.length === 0 && <p className="text-gray-400 text-xs">Todavía no hay actividades definidas.</p>}
          {actividades.map((a, i) => (
            <div key={a.id} className="flex items-center gap-1.5">
              <BotonesOrden tipo="actividad_cierre" ids={ids} indice={i} onMovido={() => { cargar(); onCambio(); }} />
              <input
                type="text"
                value={nombres[a.id] ?? ''}
                onChange={(e) => setNombres((prev) => ({ ...prev, [a.id]: e.target.value }))}
                className="flex-1 px-2 py-1 border border-gray-300 rounded"
              />
              {nombres[a.id]?.trim() !== a.nombre && (
                <button
                  disabled={ocupado || !nombres[a.id]?.trim()}
                  onClick={() => ejecutar(() => fetch(`/api/actividades-cierre/${a.id}`, json('PATCH', { nombre: nombres[a.id] })))}
                  className="text-xs px-2 py-1 bg-blue-600 text-white rounded font-semibold disabled:opacity-50"
                >
                  Guardar
                </button>
              )}
              <button
                disabled={ocupado}
                title="Quitar de la lista (las ya creadas en cada funcionalidad se mantienen)"
                onClick={() => {
                  if (confirm(`¿Quitar "${a.nombre}" de la lista?\n\nLas actividades ya creadas en cada funcionalidad se mantienen.`)) {
                    ejecutar(() => fetch(`/api/actividades-cierre/${a.id}`, json('DELETE')));
                  }
                }}
                className="text-xs px-1 text-red-500 disabled:opacity-50"
              >
                🗑️
              </button>
            </div>
          ))}
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              value={nuevo}
              onChange={(e) => setNuevo(e.target.value)}
              placeholder="Nueva actividad de cierre..."
              className="flex-1 px-2 py-1 border border-dashed border-gray-300 rounded"
            />
            <button
              disabled={ocupado || !nuevo.trim()}
              onClick={() =>
                ejecutar(async () => {
                  const res = await fetch(`/api/proyectos/${proyectoId}/actividades-cierre`, json('POST', { nombre: nuevo }));
                  if (res.ok) setNuevo('');
                  return res;
                })
              }
              className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded font-semibold disabled:opacity-50"
            >
              ➕ Agregar
            </button>
          </div>
        </div>

        <div className="border-t pt-4">
          <button
            disabled={ocupado || actividades.length === 0}
            onClick={() =>
              ejecutar(
                () => fetch(`/api/proyectos/${proyectoId}/actividades-cierre/aplicar`, json('POST')),
                (data) =>
                  `Listo: ${data.data?.creadas ?? 0} actividad(es) creada(s) y ${data.data?.reactivadas ?? 0} reactivada(s).`
              )
            }
            className="w-full px-4 py-2 border-2 border-amber-300 text-amber-800 rounded-lg font-semibold hover:bg-amber-50 disabled:opacity-50"
          >
            Aplicar a las funcionalidades ya existentes
          </button>
          <p className="text-xs text-gray-400 mt-1">
            Agrega a cada épica las actividades de la lista que le falten (y recupera las que se hayan eliminado).
          </p>
        </div>
      </div>
    </Modal>
  );
};

export default ActividadesCierreModal;
