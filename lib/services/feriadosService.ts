// lib/services/feriadosService.ts
// Feriados: lista global de fechas no laborables, usada por el Gantt para
// excluir columnas del calendario ademas de fines de semana.

import { executeProcedure } from '../db';
import { Feriado } from '@/types';

export async function marcarFeriado(fecha: string): Promise<Feriado[]> {
  return executeProcedure<Feriado>('sp_marcar_feriado', [fecha]);
}

export async function listarFeriados(): Promise<Feriado[]> {
  return executeProcedure<Feriado>('sp_listar_feriados', []);
}
