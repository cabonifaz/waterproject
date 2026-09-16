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

// Incluye también las épicas eliminadas (activa = FALSE). Solo la usa el
// importador de Excel para matchear por nombre y reactivar en vez de
// duplicar (la unique key modulo_id+nombre lo impediría igual).
export async function listarEpicasModuloTodas(moduloId: number): Promise<Epica[]> {
  return executeProcedure<Epica>('sp_listar_epicas_modulo_todas', [moduloId]);
}

// Soft-delete: oculta la épica (y sus HU dejan de verse por transitividad)
// en vez de borrarla, para poder recuperarla si fue un error.
export async function eliminarEpica(id: number): Promise<void> {
  await executeProcedure('sp_eliminar_epica', [id]);
}

// Revierte el soft-delete. Usado por el importador de Excel al detectar
// que una fila matchea por nombre a una épica eliminada.
export async function reactivarEpica(id: number): Promise<void> {
  await executeProcedure('sp_reactivar_epica', [id]);
}
