// components/SeleccionActividades.tsx
// Selección de un grupo de actividades (HU y tareas matrices) en la
// pantalla de estructura, para asignarles talentos de una vez. El
// proveedor guarda la selección; las secciones (etapa/épica) muestran
// casillas vía useSeleccion(); la barra flotante abre el modal de
// asignación.

'use client';

import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import Modal from './Modal';
import SelectorTalentos, { guardarTalentosLote } from './SelectorTalentos';
import { Miembro } from '@/types';

type Clave = `hu-${number}` | `tm-${number}`;

interface SeleccionCtx {
  seleccionadas: Set<Clave>;
  estaSeleccionada: (clave: Clave) => boolean;
  alternar: (clave: Clave) => void;
  // Selecciona todas si falta alguna; si ya estaban todas, las quita.
  alternarGrupo: (claves: Clave[]) => void;
  limpiar: () => void;
}

const Contexto = createContext<SeleccionCtx | null>(null);

export const claveHU = (id: number): Clave => `hu-${id}`;
export const claveTarea = (id: number): Clave => `tm-${id}`;

export function useSeleccion(): SeleccionCtx | null {
  return useContext(Contexto);
}

export function ProveedorSeleccion({ children }: { children: React.ReactNode }) {
  const [seleccionadas, setSeleccionadas] = useState<Set<Clave>>(new Set());

  const alternar = useCallback((clave: Clave) => {
    setSeleccionadas((prev) => {
      const next = new Set(prev);
      if (next.has(clave)) next.delete(clave);
      else next.add(clave);
      return next;
    });
  }, []);

  const alternarGrupo = useCallback((claves: Clave[]) => {
    setSeleccionadas((prev) => {
      const next = new Set(prev);
      const todas = claves.length > 0 && claves.every((c) => next.has(c));
      for (const c of claves) {
        if (todas) next.delete(c);
        else next.add(c);
      }
      return next;
    });
  }, []);

  const valor = useMemo<SeleccionCtx>(
    () => ({
      seleccionadas,
      estaSeleccionada: (c) => seleccionadas.has(c),
      alternar,
      alternarGrupo,
      limpiar: () => setSeleccionadas(new Set()),
    }),
    [seleccionadas, alternar, alternarGrupo]
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

// Casilla "seleccionar todo el grupo" (etapa o funcionalidad).
export function CasillaGrupo({ claves, titulo }: { claves: Clave[]; titulo: string }) {
  const sel = useSeleccion();
  if (!sel || claves.length === 0) return null;
  const marcadas = claves.filter((c) => sel.seleccionadas.has(c)).length;
  return (
    <input
      type="checkbox"
      title={titulo}
      checked={marcadas === claves.length}
      ref={(el) => {
        if (el) el.indeterminate = marcadas > 0 && marcadas < claves.length;
      }}
      onChange={() => sel.alternarGrupo(claves)}
      onClick={(e) => e.stopPropagation()}
      className="cursor-pointer"
    />
  );
}

export function CasillaActividad({ clave }: { clave: Clave }) {
  const sel = useSeleccion();
  if (!sel) return null;
  return (
    <input
      type="checkbox"
      title="Seleccionar para asignar talentos en grupo"
      checked={sel.seleccionadas.has(clave)}
      onChange={() => sel.alternar(clave)}
      className="cursor-pointer"
    />
  );
}

export function BarraAsignacionGrupo({ miembrosProyecto, onAsignado }: { miembrosProyecto: Miembro[]; onAsignado: () => void }) {
  const sel = useSeleccion();
  const [abierto, setAbierto] = useState(false);
  const [talentos, setTalentos] = useState<number[]>([]);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!sel || sel.seleccionadas.size === 0) return null;

  const huIds: number[] = [];
  const tareaIds: number[] = [];
  for (const c of sel.seleccionadas) {
    const id = Number(c.slice(3));
    if (c.startsWith('hu-')) huIds.push(id);
    else tareaIds.push(id);
  }

  const aplicar = async (accion: 'agregar' | 'quitar' | 'reemplazar') => {
    setGuardando(true);
    setError(null);
    try {
      await guardarTalentosLote({ huIds, tareaIds, miembroIds: talentos, accion });
      setAbierto(false);
      setTalentos([]);
      sel.limpiar();
      onAsignado();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <>
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 bg-slate-900 text-white px-5 py-3 rounded-full shadow-xl text-sm">
        <span>
          <strong>{sel.seleccionadas.size}</strong> actividad(es) seleccionada(s)
        </span>
        <button
          onClick={() => setAbierto(true)}
          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded-full font-semibold"
        >
          👥 Asignar talentos
        </button>
        <button onClick={sel.limpiar} className="text-slate-300 hover:text-white">
          Limpiar
        </button>
      </div>

      {abierto && (
        <Modal titulo="Asignar talentos al grupo" onClose={() => setAbierto(false)}>
          <div className="space-y-4">
            <p className="text-sm text-gray-500">
              {huIds.length} historia(s) de usuario y {tareaIds.length} tarea(s) matriz seleccionadas. Elegí uno o
              más talentos:
            </p>
            {error && <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded text-sm">{error}</div>}
            <SelectorTalentos miembrosProyecto={miembrosProyecto} seleccionados={talentos} onChange={setTalentos} />
            <div className="grid grid-cols-3 gap-2 pt-2">
              <button
                disabled={guardando || talentos.length === 0}
                onClick={() => aplicar('agregar')}
                title="Suma estos talentos; los que ya tenían se mantienen"
                className="px-3 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50"
              >
                ➕ Agregar
              </button>
              <button
                disabled={guardando}
                onClick={() => aplicar('reemplazar')}
                title="Cada actividad queda exactamente con estos talentos"
                className="px-3 py-2 border-2 border-blue-600 text-blue-700 rounded-lg font-semibold hover:bg-blue-50 disabled:opacity-50"
              >
                🔁 Reemplazar
              </button>
              <button
                disabled={guardando || talentos.length === 0}
                onClick={() => aplicar('quitar')}
                title="Saca estos talentos de las actividades seleccionadas"
                className="px-3 py-2 border-2 border-red-300 text-red-600 rounded-lg font-semibold hover:bg-red-50 disabled:opacity-50"
              >
                ➖ Quitar
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
