// lib/services/tareasMatricesService.ts

import { executeProcedure } from '../db';
import { TareaMatriz } from '@/types';

export async function crearTareaMatriz(datos: {
  etapa_id: number;
  titulo: string;
  descripcion?: string;
  responsable?: string;
  dias_estimados?: number;
  orden?: number;
}): Promise<number> {
  const rows = await executeProcedure<{ id: number }>('sp_crear_tarea_matriz', [
    datos.etapa_id,
    datos.titulo,
    datos.descripcion || null,
    datos.responsable || null,
    datos.dias_estimados ?? 0,
    datos.orden ?? 0,
  ]);
  return rows[0].id;
}

export async function listarTareasMatricesEtapa(etapaId: number): Promise<TareaMatriz[]> {
  return executeProcedure<TareaMatriz>('sp_listar_tareas_matrices_etapa', [etapaId]);
}

export async function actualizarDiasRestantes(id: number, dias: number | null): Promise<TareaMatriz> {
  const rows = await executeProcedure<TareaMatriz>('sp_actualizar_dias_restantes_tarea_matriz', [id, dias]);
  return rows[0];
}
