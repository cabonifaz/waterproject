// lib/services/cumplimientoService.ts
// Resumen liviano de días planificados/reales de todos los proyectos en
// una sola consulta — usado para pintar el % de cumplimiento y el
// semáforo en la lista de proyectos sin pedir la estructura completa de
// cada uno (N+1).

import { executeProcedure } from '../db';

export interface ResumenCumplimientoProyecto {
  proyecto_id: number;
  dias_planificados: number;
  dias_reales: number;
}

export async function obtenerResumenCumplimientoProyectos(): Promise<ResumenCumplimientoProyecto[]> {
  return executeProcedure<ResumenCumplimientoProyecto>('sp_resumen_cumplimiento_proyectos', []);
}
