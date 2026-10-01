// lib/services/ordenService.ts
// Reordenamiento de hermanos en la estructura (módulos, épicas, HU,
// tareas matrices) y de la lista de actividades de cierre del proyecto:
// recibe los ids en el orden deseado y cada uno queda con orden = posición.

import { executeProcedure } from '../db';

export const TIPOS_REORDENABLES = ['modulo', 'epica', 'hu', 'tarea_matriz', 'actividad_cierre'] as const;
export type TipoReordenable = (typeof TIPOS_REORDENABLES)[number];

export async function reordenar(tipo: TipoReordenable, ids: number[]): Promise<void> {
  await executeProcedure('sp_reordenar', [tipo, JSON.stringify(ids)]);
}
