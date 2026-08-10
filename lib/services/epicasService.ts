// lib/services/epicasService.ts

import { executeProcedure } from '../db';
import { Epica } from '@/types';

export async function crearEpica(datos: {
  modulo_id: number;
  nombre: string;
  orden?: number;
}): Promise<number> {
  const rows = await executeProcedure<{ id: number }>('sp_crear_epica', [
    datos.modulo_id,
    datos.nombre,
    datos.orden ?? 0,
  ]);
  return rows[0].id;
}

export async function listarEpicasModulo(moduloId: number): Promise<Epica[]> {
  return executeProcedure<Epica>('sp_listar_epicas_modulo', [moduloId]);
}
