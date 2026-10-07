// components/ActividadesCierreModal.tsx
// Gestión de las dos listas de actividades de cierre de un proyecto:
//   - Por funcionalidad: activar/desactivar la auto-creación en cada épica
//     nueva y completar las funcionalidades existentes.
//   - Por módulo (Ethical Hacking, comités, pase a producción...): se
//     agregan a pedido al final de cada módulo con "🏁 Cierre del módulo".
// En ambas se puede corregir nombres (se propaga a las ya creadas que
// mantenían el nombre anterior), reordenar (también se propaga),
// agregar y quitar.

'use client';

import { useCallback, useEffect, useState } from 'react';
import Modal from './Modal';
import BotonesOrden from './BotonesOrden';
import { ActividadCierre, AmbitoActividadCierre } from '@/types';

interface Props {
  proyectoId: number;
  onClose: () => void;
  onCambio: () => void;
}

const json = (method: string, body?: unknown) => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: body === undefined ? undefined : JSON.stringify(body),
});

const ActividadesCierreModal = ({ proyectoId, onClose, onCambio }: Props) => {
  const [auto, setAuto] = useState(false);
  const [actividades, setActividades] = useState<ActividadCierre[]>([]);
  const [nombres, setNombres] = useState<Record<number, string>>({});
  const [nuevo, setNuevo] = useState<Record<AmbitoActividadCierre, string>>({ funcionalidad: '', modulo: '' });
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

  const renderLista = (ambito: AmbitoActividadCierre) => {
    const lista = actividades.filter((a) => (a.ambito ?? 'funcionalidad') === ambito);
    const ids = lista.map((a) => a.id);
    return (
      <div className="space-y-1.5">
        {lista.length === 0 && <p className="text-gray-400 text-xs">Todavía no hay actividades definidas.</p>}
        {lista.map((a, i) => (
          <div key={a.id} className="flex items-center gap-1.5">
            <BotonesOrden
              tipo="actividad_cierre"
              ids={ids}
              indice={i}
              onMovido={() => {
                cargar();
                onCambio();
              }}
            />
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
              title="Quitar de la lista (las ya creadas se mantienen)"
              onClick={() => {
                if (confirm(`¿Quitar "${a.nombre}" de la lista?\n\nLas actividades ya creadas se mantienen.`)) {
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
            value={nuevo[ambito]}
            onChange={(e) => setNuevo((prev) => ({ ...prev, [ambito]: e.target.value }))}
            placeholder="Nueva actividad de cierre..."
            className="flex-1 px-2 py-1 border border-dashed border-gray-300 rounded"
          />
          <button
            disabled={ocupado || !nuevo[ambito].trim()}
            onClick={() =>
              ejecutar(async () => {
                const res = await fetch(
                  `/api/proyectos/${proyectoId}/actividades-cierre`,
                  json('POST', { nombre: nuevo[ambito], ambito })
                );
                if (res.ok) setNuevo((prev) => ({ ...prev, [ambito]: '' }));
                return res;
              })
            }
            className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded font-semibold disabled:opacity-50"
          >
            ➕ Agregar
          </button>
        </div>
      </div>
    );
  };

  const hayFuncionalidad = actividades.some((a) => (a.ambito ?? 'funcionalidad') === 'funcionalidad');

  return (
    <Modal titulo="🏁 Actividades de cierre" onClose={onClose} ancho="max-w-xl">
      <div className="space-y-5 text-sm">
        {error && <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded">{error}</div>}
        {aviso && <div className="p-3 bg-green-50 border border-green-200 text-green-700 rounded">{aviso}</div>}

        <section className="space-y-3">
          <h3 className="font-bold text-gray-900">Por funcionalidad</h3>
          <p className="text-gray-500 text-xs">
            Actividades obligatorias que se crean al final de cada épica / funcionalidad. Corregir un nombre o
            reordenar acá actualiza también las que ya fueron creadas.
          </p>
          <label className="flex items-center gap-2 font-medium text-gray-700">
            <input
              type="checkbox"
              checked={auto}
              disabled={ocupado || (!auto && !hayFuncionalidad)}
              onChange={(e) =>
                ejecutar(() => fetch(`/api/proyectos/${proyectoId}/actividades-cierre`, json('PUT', { auto: e.target.checked })))
              }
            />
            Crear automáticamente en cada funcionalidad nueva
          </label>
          {renderLista('funcionalidad')}
          <button
            disabled={ocupado || !hayFuncionalidad}
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
        </section>

        <section className="space-y-3 border-t pt-4">
          <h3 className="font-bold text-gray-900">Por módulo</h3>
          <p className="text-gray-500 text-xs">
            Se agregan al final del módulo que elijas con el botón <strong>🏁 Cierre del módulo</strong> (no
            solo al cierre del proyecto). Corregir o reordenar acá actualiza también las ya agregadas.
          </p>
          {renderLista('modulo')}
        </section>
      </div>
    </Modal>
  );
};

export default ActividadesCierreModal;
