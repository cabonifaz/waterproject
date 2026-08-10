// lib/services/diasPlanificadosService.ts
// Marcado día a día del Gantt (planificado): cada llamada es un toggle
// sobre una celda (fecha) de una fila (HU o tarea matriz).

import { executeProcedure } from '../db';
import { DiaPlanificadoHU, DiaPlanificadoTareaMatriz, TipoMarcaHU, TipoMarcaTareaMatriz } from '@/types';

export async function marcarDiaHU(
  historiaUsuarioId: number,
  fecha: string,
  tipoMarca: TipoMarcaHU
): Promise<DiaPlanificadoHU[]> {
  return executeProcedure<DiaPlanificadoHU>('sp_marcar_dia_hu', [historiaUsuarioId, fecha, tipoMarca]);
}

export async function marcarDiaTareaMatriz(
  tareaMatrizId: number,
  fecha: string,
  tipoMarca: TipoMarcaTareaMatriz
): Promise<DiaPlanificadoTareaMatriz[]> {
  return executeProcedure<DiaPlanificadoTareaMatriz>('sp_marcar_dia_tarea_matriz', [
    tareaMatrizId,
    fecha,
    tipoMarca,
  ]);
}

export async function listarDiasHUProyecto(
  proyectoId: number
): Promise<Array<{ historia_usuario_id: number; fecha: string; tipo_marca: TipoMarcaHU }>> {
  return executeProcedure('sp_listar_dias_hu_proyecto', [proyectoId]);
}

export async function listarDiasTareaMatrizProyecto(
  proyectoId: number
): Promise<Array<{ tarea_matriz_id: number; fecha: string; tipo_marca: TipoMarcaTareaMatriz }>> {
  return executeProcedure('sp_listar_dias_tarea_matriz_proyecto', [proyectoId]);
}
