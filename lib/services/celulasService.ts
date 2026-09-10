// lib/services/celulasService.ts
// Células (equipos) de un PI. La lista NO se comparte entre PIs.

import { executeProcedure } from '../db';
import { Celula } from '@/types';

export async function crearCelula(piId: number, nombre: string): Promise<Celula> {
  const rows = await executeProcedure<Celula>('sp_crear_celula', [piId, nombre]);
  return rows[0];
}

export async function listarCelulasPI(piId: number): Promise<Celula[]> {
  return executeProcedure<Celula>('sp_listar_celulas_pi', [piId]);
}

export async function renombrarCelula(id: number, nombre: string): Promise<Celula> {
  const rows = await executeProcedure<Celula>('sp_renombrar_celula', [id, nombre]);
  return rows[0];
}

export async function eliminarCelula(id: number): Promise<void> {
  await executeProcedure('sp_eliminar_celula', [id]);
}
