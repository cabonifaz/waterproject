// lib/services/pisService.ts
// Programa Incremental (PI): contenedor de nivel superior. Tiene sus
// propios sprints y sus propias células.

import { executeProcedure } from '../db';
import { ProgramaIncremental } from '@/types';

export async function crearPI(datos: {
  nombre: string;
  fecha_inicio?: string | null;
}): Promise<number> {
  const rows = await executeProcedure<{ id: number }>('sp_crear_pi', [
    datos.nombre,
    datos.fecha_inicio || null,
  ]);
  return rows[0].id;
}

export async function listarPIs(): Promise<ProgramaIncremental[]> {
  return executeProcedure<ProgramaIncremental>('sp_listar_pis', []);
}

export async function obtenerPI(id: number): Promise<ProgramaIncremental | null> {
  const rows = await executeProcedure<ProgramaIncremental>('sp_obtener_pi', [id]);
  return rows[0] || null;
}

export async function actualizarPI(
  id: number,
  datos: { nombre: string; fecha_inicio?: string | null; estado: 'activo' | 'cerrado' }
): Promise<ProgramaIncremental> {
  const rows = await executeProcedure<ProgramaIncremental>('sp_actualizar_pi', [
    id,
    datos.nombre,
    datos.fecha_inicio || null,
    datos.estado,
  ]);
  return rows[0];
}

export async function eliminarPI(id: number): Promise<void> {
  await executeProcedure('sp_eliminar_pi', [id]);
}
