// lib/services/baselineService.ts
// Solo lectura: el baseline se escribe una única vez desde
// sp_cerrar_planificado (ver proyectosService.cerrarPlanificado). Estas
// funciones exponen esa copia congelada para el reporte Avance Célula
// ("Días Totales" = baseline, el denominador fijo).

import { executeProcedure } from '../db';
import { TipoMarcaHU, TipoMarcaTareaMatriz } from '@/types';

export async function listarDiasHUBaselineProyecto(
  proyectoId: number
): Promise<Array<{ historia_usuario_id: number; fecha: string; tipo_marca: TipoMarcaHU }>> {
  return executeProcedure('sp_listar_dias_hu_baseline_proyecto', [proyectoId]);
}

export async function listarDiasTareaMatrizBaselineProyecto(
  proyectoId: number
): Promise<Array<{ tarea_matriz_id: number; fecha: string; tipo_marca: TipoMarcaTareaMatriz }>> {
  return executeProcedure('sp_listar_dias_tarea_matriz_baseline_proyecto', [proyectoId]);
}
