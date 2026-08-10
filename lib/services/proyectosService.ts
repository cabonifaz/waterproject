// lib/services/proyectosService.ts

import { executeProcedure } from '../db';
import { Proyecto } from '@/types';

export async function crearProyecto(datos: {
  nombre: string;
  descripcion?: string;
  fecha_inicio: string;
}): Promise<number> {
  const rows = await executeProcedure<{ id: number }>('sp_crear_proyecto', [
    datos.nombre,
    datos.descripcion || null,
    datos.fecha_inicio,
  ]);
  return rows[0].id;
}

export async function listarProyectos(): Promise<Proyecto[]> {
  return executeProcedure<Proyecto>('sp_listar_proyectos', []);
}

export async function obtenerProyecto(id: number): Promise<Proyecto | null> {
  const rows = await executeProcedure<Proyecto>('sp_obtener_proyecto', [id]);
  return rows[0] || null;
}

export async function eliminarProyecto(id: number): Promise<void> {
  await executeProcedure('sp_eliminar_proyecto', [id]);
}

export async function cerrarPlanificado(id: number): Promise<Proyecto> {
  const rows = await executeProcedure<Proyecto>('sp_cerrar_planificado', [id]);
  return rows[0];
}

export async function reactivarPlanificado(id: number): Promise<Proyecto> {
  const rows = await executeProcedure<Proyecto>('sp_reactivar_planificado', [id]);
  return rows[0];
}
