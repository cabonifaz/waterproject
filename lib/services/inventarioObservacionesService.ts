// lib/services/inventarioObservacionesService.ts
// Compone el inventario completo de observaciones de un proyecto en pocas
// consultas (evita N+1) — mismo patrón que estructuraService: se traen
// las listas por separado y se combinan en memoria. El filtrado y el
// orden de la página de inventario se resuelven en el frontend sobre este
// array ya aplanado.

import * as observacionesService from './observacionesService';
import * as miembrosService from './miembrosService';
import { ObservacionInventario, Miembro } from '@/types';

export async function obtenerInventarioObservaciones(proyectoId: number): Promise<ObservacionInventario[]> {
  const [filas, iteraciones, conteoImagenes, asignaciones, miembros] = await Promise.all([
    observacionesService.listarObservacionesProyecto(proyectoId),
    observacionesService.listarIteracionesProyecto(proyectoId),
    observacionesService.listarConteoImagenesProyecto(proyectoId),
    observacionesService.listarMiembrosObservacionesProyecto(proyectoId),
    miembrosService.listarMiembrosProyecto(proyectoId),
  ]);

  const iteracionesPorObs = new Map<number, number>(iteraciones.map((i) => [i.observacion_id, i.iteraciones]));
  const imagenesPorObs = new Map<number, number>(conteoImagenes.map((i) => [i.observacion_id, i.cantidad]));
  const miembrosPorId = new Map<number, Miembro>(miembros.map((m) => [m.id, m]));

  const miembrosPorObs = new Map<number, Miembro[]>();
  for (const a of asignaciones) {
    const miembro = miembrosPorId.get(a.miembro_id);
    if (!miembro) continue;
    const lista = miembrosPorObs.get(a.observacion_id) || [];
    lista.push(miembro);
    miembrosPorObs.set(a.observacion_id, lista);
  }

  return filas.map(
    (f): ObservacionInventario => ({
      id: f.id,
      historia_usuario_id: f.historia_usuario_id,
      titulo: f.titulo,
      descripcion: f.descripcion,
      estado: f.estado,
      created_at: f.created_at,
      updated_at: f.updated_at,
      iteraciones: iteracionesPorObs.get(f.id) || 0,
      cantidad_imagenes: imagenesPorObs.get(f.id) || 0,
      huCodigo: f.hu_codigo,
      huTitulo: f.hu_titulo,
      epicaId: f.epica_id,
      epicaNombre: f.epica_nombre,
      moduloId: f.modulo_id,
      moduloNombre: f.modulo_nombre,
      etapaId: f.etapa_id,
      etapaNombre: f.etapa_nombre,
      miembros: miembrosPorObs.get(f.id) || [],
    })
  );
}
