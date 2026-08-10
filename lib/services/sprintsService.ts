// lib/services/sprintsService.ts
// Sprints: plantilla global, compartida por todos los proyectos (no van por proyecto_id).

import { executeProcedure } from '../db';
import { Sprint } from '@/types';

export async function generarSprints(datos: {
  fecha_inicio: string;
  dias_duracion: number;
  cantidad: number;
  dias_priorizacion?: number;
}): Promise<Sprint[]> {
  return executeProcedure<Sprint>('sp_generar_sprints', [
    datos.fecha_inicio,
    datos.dias_duracion,
    datos.cantidad,
    datos.dias_priorizacion || 0,
  ]);
}

export async function listarSprints(): Promise<Sprint[]> {
  return executeProcedure<Sprint>('sp_listar_sprints', []);
}
