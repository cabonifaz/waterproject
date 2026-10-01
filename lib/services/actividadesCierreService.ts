// lib/services/actividadesCierreService.ts
// Actividades de cierre por funcionalidad: lista de nombres por proyecto
// que, si está activada, se crea como HU (es_actividad_cierre) en cada
// épica nueva. Ver sección 19 de DATABASE_SCHEMA.sql.

import { executeProcedure } from '../db';
import { ActividadCierre } from '@/types';

export async function listarActividadesCierre(proyectoId: number): Promise<ActividadCierre[]> {
  return executeProcedure<ActividadCierre>('sp_listar_actividades_cierre', [proyectoId]);
}

export async function configurarAutoActividadesCierre(proyectoId: number, auto: boolean): Promise<void> {
  await executeProcedure('sp_configurar_actividades_cierre', [proyectoId, auto]);
}

export async function crearActividadCierre(proyectoId: number, nombre: string): Promise<ActividadCierre> {
  const rows = await executeProcedure<ActividadCierre>('sp_crear_actividad_cierre', [proyectoId, nombre]);
  return rows[0];
}

export async function renombrarActividadCierre(id: number, nombre: string): Promise<ActividadCierre> {
  const rows = await executeProcedure<ActividadCierre>('sp_renombrar_actividad_cierre', [id, nombre]);
  return rows[0];
}

export async function eliminarActividadCierre(id: number): Promise<void> {
  await executeProcedure('sp_eliminar_actividad_cierre', [id]);
}

export async function aplicarActividadesCierre(proyectoId: number): Promise<{ creadas: number; reactivadas: number }> {
  const rows = await executeProcedure<{ creadas: number; reactivadas: number }>('sp_aplicar_actividades_cierre', [
    proyectoId,
  ]);
  return rows[0] ?? { creadas: 0, reactivadas: 0 };
}
