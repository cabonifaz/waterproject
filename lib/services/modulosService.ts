// lib/services/modulosService.ts

import { executeProcedure } from '../db';
import { Modulo } from '@/types';

export async function crearModulo(datos: {
  etapa_id: number;
  nombre: string;
  orden?: number;
}): Promise<number> {
  const rows = await executeProcedure<{ id: number }>('sp_crear_modulo', [
    datos.etapa_id,
    datos.nombre,
    datos.orden ?? 0,
  ]);
  return rows[0].id;
}

export async function listarModulosEtapa(etapaId: number): Promise<Modulo[]> {
  return executeProcedure<Modulo>('sp_listar_modulos_etapa', [etapaId]);
}
