// components/DetalleObservacion.tsx
// Detalle completo de una observación: cambio de estado (con nota,
// registrado en el historial), miembros asignados, imágenes adjuntas
// (subir/ver/borrar) e historial de iteraciones.

'use client';

import { useEffect, useState } from 'react';
import SelectorMiembros from './SelectorMiembros';
import { ObservacionCompleta, Miembro } from '@/types';
import { ESTADOS_OBSERVACION, ESTADO_LABEL, ESTADO_COLOR, formatFechaHora } from '@/lib/observacionesUI';

interface Props {
  observacionId: number;
  miembrosProyecto: Miembro[];
  onVolver: () => void;
  onCambio: () => void; // avisa al padre para refrescar la lista/badges
}

const DetalleObservacion = ({ observacionId, miembrosProyecto, onVolver, onCambio }: Props) => {
  const [obs, setObs] = useState<ObservacionCompleta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nota, setNota] = useState('');
  const [cambiandoEstado, setCambiandoEstado] = useState(false);
  const [subiendoImagen, setSubiendoImagen] = useState(false);
  const [imagenAmpliada, setImagenAmpliada] = useState<number | null>(null);

  const cargar = async () => {
    try {
      const res = await fetch(`/api/observaciones/${observacionId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al obtener la observación');
      setObs(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [observacionId]);

  const handleCambiarEstado = async (estado: string) => {
    setCambiandoEstado(true);
    setError(null);
    try {
      const res = await fetch(`/api/observaciones/${observacionId}/estado`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado, nota: nota.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al cambiar el estado');
      setNota('');
      await cargar();
      onCambio();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cambiar el estado');
    } finally {
      setCambiandoEstado(false);
    }
  };

  const handleSubirImagen = async (archivo: File) => {
    setSubiendoImagen(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('archivo', archivo);
      const res = await fetch(`/api/observaciones/${observacionId}/imagenes`, { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al subir la imagen');
      await cargar();
      onCambio();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo subir la imagen');
    } finally {
      setSubiendoImagen(false);
    }
  };

  const handleEliminarImagen = async (imagenId: number) => {
    if (!confirm('¿Eliminar esta imagen?')) return;
    await fetch(`/api/observaciones/${observacionId}/imagenes/${imagenId}`, { method: 'DELETE' });
    setImagenAmpliada(null);
    await cargar();
    onCambio();
  };

  if (loading) return <div className="animate-pulse h-40 bg-gray-100 rounded" />;
  if (!obs) return <p className="text-red-600 text-sm">{error || 'No se pudo cargar la observación.'}</p>;

  return (
    <div className="space-y-5">
      <button onClick={onVolver} className="text-sm text-blue-600 hover:text-blue-800 font-semibold">
        ← Volver al inventario
      </button>

      {error && <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded text-sm">{error}</div>}

      <div>
        <h3 className="font-bold text-lg text-gray-900">{obs.titulo}</h3>
        {obs.descripcion && <p className="text-sm text-gray-600 mt-1 whitespace-pre-wrap">{obs.descripcion}</p>}
        <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
          <span>Creada: {formatFechaHora(obs.created_at)}</span>
          <span>·</span>
          <span>{obs.iteraciones} iteración{obs.iteraciones === 1 ? '' : 'es'}</span>
        </div>
      </div>

      <div>
        <p className="text-sm font-semibold text-gray-700 mb-2">Estado</p>
        <div className="flex flex-wrap gap-2">
          {ESTADOS_OBSERVACION.map((e) => (
            <button
              key={e}
              onClick={() => handleCambiarEstado(e)}
              disabled={cambiandoEstado || obs.estado === e}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border-2 transition-colors disabled:cursor-default ${
                obs.estado === e ? ESTADO_COLOR[e] : 'border-gray-200 text-gray-500 hover:border-gray-300'
              }`}
            >
              {ESTADO_LABEL[e]}
            </button>
          ))}
        </div>
        <input
          type="text"
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          placeholder="Nota opcional para el próximo cambio de estado..."
          className="mt-2 w-full text-sm px-3 py-1.5 border border-gray-300 rounded-lg"
        />
      </div>

      <div>
        <p className="text-sm font-semibold text-gray-700 mb-2">Asignado a</p>
        <SelectorMiembros
          endpoint={`/api/observaciones/${observacionId}/miembros`}
          miembrosProyecto={miembrosProyecto}
          miembrosAsignados={obs.miembros}
          onRefrescar={() => {
            cargar();
            onCambio();
          }}
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-semibold text-gray-700">Imágenes ({obs.imagenes.length})</p>
          <label className="text-xs text-blue-600 hover:text-blue-800 font-semibold cursor-pointer">
            {subiendoImagen ? '⏳ Subiendo...' : '📎 Adjuntar imagen'}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={subiendoImagen}
              onChange={(e) => {
                const archivo = e.target.files?.[0];
                if (archivo) handleSubirImagen(archivo);
                e.target.value = '';
              }}
            />
          </label>
        </div>
        {obs.imagenes.length === 0 ? (
          <p className="text-xs text-gray-400">Sin imágenes adjuntas todavía.</p>
        ) : (
          <div className="grid grid-cols-4 gap-2">
            {obs.imagenes.map((img) => (
              <button
                key={img.id}
                onClick={() => setImagenAmpliada(img.id)}
                className="aspect-square rounded-lg overflow-hidden border border-gray-200 hover:border-blue-400"
                title={img.nombre_archivo}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/observaciones/${observacionId}/imagenes/${img.id}`}
                  alt={img.nombre_archivo}
                  className="w-full h-full object-cover"
                />
              </button>
            ))}
          </div>
        )}
      </div>

      <div>
        <p className="text-sm font-semibold text-gray-700 mb-2">Historial</p>
        <ul className="space-y-1.5 text-xs text-gray-500 max-h-40 overflow-y-auto">
          {obs.historial.map((h) => (
            <li key={h.id} className="flex items-start gap-2">
              <span className="text-gray-400 flex-shrink-0">{formatFechaHora(h.created_at)}</span>
              <span>
                {h.estado_anterior ? (
                  <>
                    {ESTADO_LABEL[h.estado_anterior]} → <strong>{ESTADO_LABEL[h.estado_nuevo]}</strong>
                  </>
                ) : (
                  <>
                    Creada en <strong>{ESTADO_LABEL[h.estado_nuevo]}</strong>
                  </>
                )}
                {h.nota && <span className="italic text-gray-400"> — {h.nota}</span>}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {imagenAmpliada != null && (
        <div
          className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-[60] p-6"
          onClick={() => setImagenAmpliada(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/observaciones/${observacionId}/imagenes/${imagenAmpliada}`}
            alt="Imagen ampliada"
            className="max-w-full max-h-full rounded-lg"
          />
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleEliminarImagen(imagenAmpliada);
            }}
            className="absolute top-6 right-6 px-4 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700"
          >
            🗑️ Eliminar imagen
          </button>
        </div>
      )}
    </div>
  );
};

export default DetalleObservacion;
