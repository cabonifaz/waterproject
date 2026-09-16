// lib/services/historiasUsuarioService.ts

import { executeProcedure } from '../db';
import { HistoriaUsuario } from '@/types';

export async function crearHistoriaUsuario(datos: {
  epica_id: number;
  codigo?: string;
  titulo: string;
  descripcion?: string;
  responsable?: string;
  prioridad?: string;
  dias_desarrollo?: number;
  dias_certificacion?: number;
  orden?: number;
}): Promise<number> {
  const rows = await executeProcedure<{ id: number }>('sp_crear_historia_usuario', [
    datos.epica_id,
    datos.codigo || null,
    datos.titulo,
    datos.descripcion || null,
    datos.responsable || null,
    datos.prioridad || 'media',
    datos.dias_desarrollo ?? 0,
    datos.dias_certificacion ?? 0,
    datos.orden ?? 0,
  ]);
  return rows[0].id;
}

export async function listarHUEpica(epicaId: number): Promise<HistoriaUsuario[]> {
  return executeProcedure<HistoriaUsuario>('sp_listar_hu_epica', [epicaId]);
}

// Incluye también las HU eliminadas (activa = FALSE). Solo la usa el
// importador de Excel para matchear por código y reactivar en vez de duplicar.
export async function listarHUEpicaTodas(epicaId: number): Promise<HistoriaUsuario[]> {
  return executeProcedure<HistoriaUsuario>('sp_listar_hu_epica_todas', [epicaId]);
}

export async function cerrarHistoriaUsuario(id: number): Promise<HistoriaUsuario> {
  const rows = await executeProcedure<HistoriaUsuario>('sp_cerrar_historia_usuario', [id]);
  return rows[0];
}

export async function actualizarDiasRestantes(id: number, dias: number | null): Promise<HistoriaUsuario> {
  const rows = await executeProcedure<HistoriaUsuario>('sp_actualizar_dias_restantes_hu', [id, dias]);
  return rows[0];
}

// Soft-delete: oculta la HU (activa = FALSE) en vez de borrarla, para
// poder recuperarla si fue un error.
export async function eliminarHistoriaUsuario(id: number): Promise<void> {
  await executeProcedure('sp_eliminar_historia_usuario', [id]);
}

// Revierte el soft-delete. Usado por el importador de Excel al detectar
// que una fila matchea por código a una HU eliminada.
export async function reactivarHistoriaUsuario(id: number): Promise<void> {
  await executeProcedure('sp_reactivar_historia_usuario', [id]);
}
