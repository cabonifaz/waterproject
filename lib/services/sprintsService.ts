// lib/services/sprintsService.ts
// Sprints POR PI: cada Programa Incremental tiene su propia secuencia.
// Definen las columnas del Gantt de los proyectos de ese PI.

import { executeProcedure } from '../db';
import { Sprint } from '@/types';

export async function generarSprints(
  piId: number,
  datos: {
    fecha_inicio: string;
    dias_duracion: number;
    cantidad: number;
    dias_priorizacion?: number;
  }
): Promise<Sprint[]> {
  return executeProcedure<Sprint>('sp_generar_sprints', [
    piId,
    datos.fecha_inicio,
    datos.dias_duracion,
    datos.cantidad,
    datos.dias_priorizacion || 0,
  ]);
}

export async function listarSprintsPI(piId: number): Promise<Sprint[]> {
  return executeProcedure<Sprint>('sp_listar_sprints_pi', [piId]);
}

// Sprints que le corresponden a un proyecto = los del PI al que pertenece.
export async function listarSprintsProyecto(proyectoId: number): Promise<Sprint[]> {
  return executeProcedure<Sprint>('sp_listar_sprints_proyecto', [proyectoId]);
}
