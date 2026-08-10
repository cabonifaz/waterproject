// lib/services/miembrosService.ts
// Miembros del proyecto (nombre + iniciales) y su asignación N:M a HU y
// tareas matrices. Asignar/desasignar es un toggle, igual que los días
// planificados y los feriados.

import { executeProcedure } from '../db';
import { Miembro } from '@/types';

export async function crearMiembro(datos: {
  proyecto_id: number;
  nombre: string;
  iniciales: string;
}): Promise<number> {
  const resultado = await executeProcedure<{ id: number }>('sp_crear_miembro', [
    datos.proyecto_id,
    datos.nombre,
    datos.iniciales,
  ]);
  return resultado[0].id;
}

export async function listarMiembrosProyecto(proyectoId: number): Promise<Miembro[]> {
  return executeProcedure<Miembro>('sp_listar_miembros_proyecto', [proyectoId]);
}

export async function eliminarMiembro(id: number): Promise<void> {
  await executeProcedure('sp_eliminar_miembro', [id]);
}

export async function asignarMiembroHU(historiaUsuarioId: number, miembroId: number): Promise<void> {
  await executeProcedure('sp_asignar_miembro_hu', [historiaUsuarioId, miembroId]);
}

export async function asignarMiembroTareaMatriz(tareaMatrizId: number, miembroId: number): Promise<void> {
  await executeProcedure('sp_asignar_miembro_tarea_matriz', [tareaMatrizId, miembroId]);
}

export async function listarAsignacionesHUProyecto(
  proyectoId: number
): Promise<Array<{ historia_usuario_id: number; miembro_id: number }>> {
  return executeProcedure('sp_listar_hu_miembros_proyecto', [proyectoId]);
}

export async function listarAsignacionesTareaMatrizProyecto(
  proyectoId: number
): Promise<Array<{ tarea_matriz_id: number; miembro_id: number }>> {
  return executeProcedure('sp_listar_tarea_matriz_miembros_proyecto', [proyectoId]);
}
