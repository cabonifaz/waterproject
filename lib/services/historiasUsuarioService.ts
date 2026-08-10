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

export async function cerrarHistoriaUsuario(id: number): Promise<HistoriaUsuario> {
  const rows = await executeProcedure<HistoriaUsuario>('sp_cerrar_historia_usuario', [id]);
  return rows[0];
}
