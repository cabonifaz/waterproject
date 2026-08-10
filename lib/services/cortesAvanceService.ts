// lib/services/cortesAvanceService.ts
// Persistencia de los cortes de "Avance Célula": guardar es reemplazar el
// detalle del corte de la fecha dada (crea el corte si no existía) fila
// por fila, igual que plantillaService arma la plantilla estándar con un
// loop de llamadas a SP.

import { executeProcedure } from '../db';
import { CorteAvance, DetalleCorteAvance, FilaAvanceCedula } from '@/types';

export async function guardarCorte(
  proyectoId: number,
  fechaCorte: string,
  filas: FilaAvanceCedula[]
): Promise<number> {
  const resultado = await executeProcedure<{ id: number }>('sp_crear_o_reusar_corte_avance', [
    proyectoId,
    fechaCorte,
  ]);
  const corteId = resultado[0].id;

  for (let i = 0; i < filas.length; i++) {
    const f = filas[i];
    await executeProcedure('sp_agregar_detalle_corte_avance', [
      corteId,
      f.tipo,
      f.referenciaId,
      f.etapaNombre,
      f.nombre,
      i,
      f.diasTotales,
      f.diasPlanificados,
      f.diasReales,
    ]);
  }

  return corteId;
}

export async function listarCortes(proyectoId: number): Promise<CorteAvance[]> {
  return executeProcedure<CorteAvance>('sp_listar_cortes_avance', [proyectoId]);
}

export async function obtenerCorteAnterior(proyectoId: number, fechaCorte: string): Promise<CorteAvance | null> {
  const rows = await executeProcedure<CorteAvance>('sp_obtener_corte_anterior', [proyectoId, fechaCorte]);
  return rows[0] || null;
}

export async function obtenerCortePorFecha(proyectoId: number, fechaCorte: string): Promise<CorteAvance | null> {
  const cortes = await listarCortes(proyectoId);
  // mysql2 devuelve las columnas DATE como objeto Date (no string) — hay
  // que normalizar con toISOString() antes de comparar, no alcanza con
  // String(...) directo (da el formato largo de Date.toString()).
  return cortes.find((c) => new Date(c.fecha_corte).toISOString().slice(0, 10) === fechaCorte) || null;
}

export async function listarDetalleCorte(corteId: number): Promise<DetalleCorteAvance[]> {
  return executeProcedure<DetalleCorteAvance>('sp_listar_detalle_corte_avance', [corteId]);
}
