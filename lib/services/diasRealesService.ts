// lib/services/diasRealesService.ts
// Marcado día a día del Gantt REAL (ejecución) — mismo patrón de toggle
// que el planificado (lib/services/diasPlanificadosService.ts) pero en
// tablas separadas. El servidor exige que el planificado esté 'cerrado'
// para aceptar cualquier marca acá (ver sp_marcar_dia_hu_real).

import { executeProcedure } from '../db';
import { DiaPlanificadoHU, DiaPlanificadoTareaMatriz, TipoMarcaHU, TipoMarcaTareaMatriz } from '@/types';

export async function marcarDiaHURealidad(
  historiaUsuarioId: number,
  fecha: string,
  tipoMarca: TipoMarcaHU
): Promise<DiaPlanificadoHU[]> {
  return executeProcedure<DiaPlanificadoHU>('sp_marcar_dia_hu_real', [historiaUsuarioId, fecha, tipoMarca]);
}

export async function marcarDiaTareaMatrizRealidad(
  tareaMatrizId: number,
  fecha: string,
  tipoMarca: TipoMarcaTareaMatriz
): Promise<DiaPlanificadoTareaMatriz[]> {
  return executeProcedure<DiaPlanificadoTareaMatriz>('sp_marcar_dia_tarea_matriz_real', [
    tareaMatrizId,
    fecha,
    tipoMarca,
  ]);
}

export async function listarDiasHURealProyecto(
  proyectoId: number
): Promise<Array<{ historia_usuario_id: number; fecha: string; tipo_marca: TipoMarcaHU }>> {
  return executeProcedure('sp_listar_dias_hu_real_proyecto', [proyectoId]);
}

export async function listarDiasTareaMatrizRealProyecto(
  proyectoId: number
): Promise<Array<{ tarea_matriz_id: number; fecha: string; tipo_marca: TipoMarcaTareaMatriz }>> {
  return executeProcedure('sp_listar_dias_tarea_matriz_real_proyecto', [proyectoId]);
}
