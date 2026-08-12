// lib/services/observacionesService.ts
// Observaciones de certificación por HU: creación, cambio de estado (con
// historial — que además es la fuente de "cuántas iteraciones" tuvo cada
// observación), asignación de miembros y listados para el inventario del
// proyecto. Las imágenes van en un servicio aparte (observacionesImagenesService).

import { executeProcedure } from '../db';
import * as observacionesImagenesService from './observacionesImagenesService';
import {
  Observacion,
  ObservacionConContadores,
  ObservacionCompleta,
  HistorialObservacion,
  EstadoObservacion,
  Miembro,
} from '@/types';

export async function crearObservacion(datos: {
  historia_usuario_id: number;
  titulo: string;
  descripcion?: string;
}): Promise<Observacion> {
  const resultado = await executeProcedure<Observacion>('sp_crear_observacion', [
    datos.historia_usuario_id,
    datos.titulo,
    datos.descripcion || null,
  ]);
  return resultado[0];
}

export async function listarObservacionesHU(historiaUsuarioId: number): Promise<ObservacionConContadores[]> {
  return executeProcedure<ObservacionConContadores>('sp_listar_observaciones_hu', [historiaUsuarioId]);
}

export async function obtenerObservacion(id: number): Promise<Observacion | null> {
  const resultado = await executeProcedure<Observacion>('sp_obtener_observacion', [id]);
  return resultado[0] || null;
}

export async function cambiarEstadoObservacion(
  id: number,
  estadoNuevo: EstadoObservacion,
  nota?: string
): Promise<Observacion> {
  const resultado = await executeProcedure<Observacion>('sp_cambiar_estado_observacion', [id, estadoNuevo, nota || null]);
  return resultado[0];
}

export async function eliminarObservacion(id: number): Promise<void> {
  await executeProcedure('sp_eliminar_observacion', [id]);
}

export async function listarHistorialObservacion(observacionId: number): Promise<HistorialObservacion[]> {
  return executeProcedure<HistorialObservacion>('sp_listar_historial_observacion', [observacionId]);
}

export async function asignarMiembroObservacion(observacionId: number, miembroId: number): Promise<void> {
  await executeProcedure('sp_asignar_miembro_observacion', [observacionId, miembroId]);
}

export async function listarMiembrosObservacion(observacionId: number): Promise<Miembro[]> {
  return executeProcedure<Miembro>('sp_listar_miembros_observacion', [observacionId]);
}

// Composición para el modal de detalle: todo lo que necesita en una sola
// llamada (evita que el frontend dispare 4 fetches por separado).
export async function obtenerObservacionCompleta(id: number): Promise<ObservacionCompleta | null> {
  const obs = await obtenerObservacion(id);
  if (!obs) return null;

  const [historial, miembros, imagenes] = await Promise.all([
    listarHistorialObservacion(id),
    listarMiembrosObservacion(id),
    observacionesImagenesService.listarImagenes(id),
  ]);

  const iteraciones = historial.filter((h) => h.estado_anterior !== null).length;

  return { ...obs, iteraciones, cantidad_imagenes: imagenes.length, historial, miembros, imagenes };
}

// --- Inventario a nivel proyecto (para la página de filtros) ---

export interface FilaObservacionProyecto {
  id: number;
  historia_usuario_id: number;
  titulo: string;
  descripcion?: string;
  estado: EstadoObservacion;
  created_at: Date;
  updated_at: Date;
  hu_codigo?: string;
  hu_titulo: string;
  epica_id: number;
  epica_nombre: string;
  modulo_id: number;
  modulo_nombre: string;
  etapa_id: number;
  etapa_nombre: string;
}

export async function listarObservacionesProyecto(proyectoId: number): Promise<FilaObservacionProyecto[]> {
  return executeProcedure<FilaObservacionProyecto>('sp_listar_observaciones_proyecto', [proyectoId]);
}

export async function listarIteracionesProyecto(
  proyectoId: number
): Promise<Array<{ observacion_id: number; iteraciones: number }>> {
  return executeProcedure('sp_listar_iteraciones_observaciones_proyecto', [proyectoId]);
}

export async function listarConteoImagenesProyecto(
  proyectoId: number
): Promise<Array<{ observacion_id: number; cantidad: number }>> {
  return executeProcedure('sp_listar_conteo_imagenes_proyecto', [proyectoId]);
}

export async function listarMiembrosObservacionesProyecto(
  proyectoId: number
): Promise<Array<{ observacion_id: number; miembro_id: number }>> {
  return executeProcedure('sp_listar_miembros_observaciones_proyecto', [proyectoId]);
}
