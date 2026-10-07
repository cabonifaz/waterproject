// lib/services/etapasService.ts

import { executeProcedure } from '../db';
import { Etapa } from '@/types';

export async function crearEtapa(datos: {
  proyecto_id: number;
  nombre: string;
  tipo?: 'desarrollo' | 'simple';
  orden?: number;
}): Promise<number> {
  const rows = await executeProcedure<{ id: number }>('sp_crear_etapa', [
    datos.proyecto_id,
    datos.nombre,
    datos.tipo || 'simple',
    datos.orden ?? 0,
  ]);
  return rows[0].id;
}

export async function listarEtapasProyecto(proyectoId: number): Promise<Etapa[]> {
  return executeProcedure<Etapa>('sp_listar_etapas_proyecto', [proyectoId]);
}

// Etapas desactivadas (ej. "Cierre" cuando cada módulo tiene su cierre).
export async function listarEtapasInactivasProyecto(proyectoId: number): Promise<Etapa[]> {
  return executeProcedure<Etapa>('sp_listar_etapas_inactivas_proyecto', [proyectoId]);
}

// Activa / desactiva una etapa (la de Desarrollo no se puede desactivar).
export async function cambiarEstadoEtapa(id: number, activa: boolean): Promise<Etapa> {
  const rows = await executeProcedure<Etapa>('sp_cambiar_estado_etapa', [id, activa]);
  return rows[0];
}
