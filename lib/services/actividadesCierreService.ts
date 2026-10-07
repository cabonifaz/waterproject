// lib/services/actividadesCierreService.ts
// Actividades de cierre, dos listas por proyecto:
//   - por funcionalidad: si está activada, se crea como HU
//     (es_actividad_cierre) en cada épica nueva (sección 19 del schema).
//   - por módulo: se agrega a pedido al final de un módulo como el bloque
//     "Cierre del módulo" (sección 21 del schema).

import { executeProcedure } from '../db';
import { ActividadCierre, AmbitoActividadCierre } from '@/types';

export async function listarActividadesCierre(proyectoId: number): Promise<ActividadCierre[]> {
  return executeProcedure<ActividadCierre>('sp_listar_actividades_cierre', [proyectoId]);
}

export async function configurarAutoActividadesCierre(proyectoId: number, auto: boolean): Promise<void> {
  await executeProcedure('sp_configurar_actividades_cierre', [proyectoId, auto]);
}

export async function crearActividadCierre(
  proyectoId: number,
  nombre: string,
  ambito: AmbitoActividadCierre = 'funcionalidad'
): Promise<ActividadCierre> {
  const rows = await executeProcedure<ActividadCierre>('sp_crear_actividad_cierre', [proyectoId, nombre, ambito]);
  return rows[0];
}

// Lista por defecto de cierre de módulo (Ethical Hacking, comités, pase a
// producción) si el proyecto todavía no tiene ninguna.
export async function inicializarCierreModulo(proyectoId: number): Promise<void> {
  await executeProcedure('sp_inicializar_cierre_modulo', [proyectoId]);
}

// Agrega (o completa/reactiva) el bloque "Cierre del módulo" al final del módulo.
export async function agregarCierreModulo(moduloId: number): Promise<number> {
  const rows = await executeProcedure<{ epica_id: number }>('sp_agregar_cierre_modulo', [moduloId]);
  return rows[0]?.epica_id;
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
