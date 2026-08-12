// components/ObservacionesModal.tsx
// Modal de observaciones de certificación de una HU: lista compacta +
// formulario de alta + navegación al detalle (estado, miembros, imágenes,
// historial). Se abre desde el botón "📋" de cada fila HU en el Gantt Real.

'use client';

import { useCallback, useEffect, useState } from 'react';
import Modal from './Modal';
import DetalleObservacion from './DetalleObservacion';
import { ObservacionConContadores, Miembro } from '@/types';
import { ESTADO_LABEL, ESTADO_COLOR, formatFecha } from '@/lib/observacionesUI';

interface Props {
  historiaUsuarioId: number;
  huEtiqueta: string;
  miembrosProyecto: Miembro[];
  onClose: () => void;
  onCambio: () => void; // avisa al Gantt para refrescar el badge de conteo
}

const ObservacionesModal = ({ historiaUsuarioId, huEtiqueta, miembrosProyecto, onClose, onCambio }: Props) => {
  const [observaciones, setObservaciones] = useState<ObservacionConContadores[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detalleId, setDetalleId] = useState<number | null>(null);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [creando, setCreando] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const res = await fetch(`/api/historias-usuario/${historiaUsuarioId}/observaciones`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al obtener las observaciones');
      setObservaciones(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  }, [historiaUsuarioId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const handleCrear = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreando(true);
    setError(null);
    try {
      const res = await fetch('/api/observaciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ historia_usuario_id: historiaUsuarioId, titulo, descripcion: descripcion || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al crear la observación');
      setTitulo('');
      setDescripcion('');
      setMostrarForm(false);
      await cargar();
      onCambio();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear la observación');
    } finally {
      setCreando(false);
    }
  };

  return (
    <Modal
      titulo={detalleId != null ? 'Detalle de Observación' : `📋 Observaciones — ${huEtiqueta}`}
      onClose={onClose}
      ancho="max-w-2xl"
    >
      {detalleId != null ? (
        <DetalleObservacion
          observacionId={detalleId}
          miembrosProyecto={miembrosProyecto}
          onVolver={() => {
            setDetalleId(null);
            cargar();
          }}
          onCambio={() => {
            cargar();
            onCambio();
          }}
        />
      ) : (
        <div className="space-y-4">
          {error && <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded text-sm">{error}</div>}

          <button
            onClick={() => setMostrarForm((v) => !v)}
            className="text-sm text-blue-600 hover:text-blue-800 font-semibold"
          >
            {mostrarForm ? '✕ Cancelar' : '➕ Nueva observación'}
          </button>

          {mostrarForm && (
            <form onSubmit={handleCrear} className="space-y-3 bg-gray-50 p-4 rounded-lg">
              <input
                type="text"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                required
                autoFocus
                placeholder="Título de la observación *"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
              <textarea
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                placeholder="Descripción (opcional)"
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
              <button
                type="submit"
                disabled={creando}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
              >
                {creando ? 'Creando...' : 'Crear observación'}
              </button>
            </form>
          )}

          {loading && <div className="animate-pulse h-24 bg-gray-100 rounded" />}

          {!loading && observaciones.length === 0 && (
            <p className="text-sm text-gray-400">Sin observaciones registradas todavía para esta HU.</p>
          )}

          <div className="space-y-2">
            {observaciones.map((o) => (
              <button
                key={o.id}
                onClick={() => setDetalleId(o.id)}
                className="w-full text-left p-3 border border-gray-200 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-colors"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-sm text-gray-900 truncate">{o.titulo}</span>
                  <span className={`flex-shrink-0 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${ESTADO_COLOR[o.estado]}`}>
                    {ESTADO_LABEL[o.estado]}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-1 text-[11px] text-gray-400">
                  <span>{formatFecha(o.created_at)}</span>
                  <span>·</span>
                  <span>{o.iteraciones} iteración{o.iteraciones === 1 ? '' : 'es'}</span>
                  {o.cantidad_imagenes > 0 && (
                    <>
                      <span>·</span>
                      <span>📎 {o.cantidad_imagenes}</span>
                    </>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </Modal>
  );
};

export default ObservacionesModal;
