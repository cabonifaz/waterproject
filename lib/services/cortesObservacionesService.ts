// lib/services/cortesObservacionesService.ts
// Cortes (snapshots) del avance de observaciones: cuántas HU tienen
// observaciones, cuántas siguen abiertas y cuántas ya certificaron todas
// las suyas — para trackear la evolución a lo largo del tiempo. Cada
// "Guardar corte" es una fila nueva (no upsert por día), así se puede
// tomar más de un corte por día/hora si hace falta.

import { executeProcedure } from '../db';
import * as inventarioObservacionesService from './inventarioObservacionesService';
import { CorteObservaciones, ObservacionInventario } from '@/types';

export interface ResumenObservacionesHU {
  totalHUConObservaciones: number;
  huAbiertas: number;
  huCertificadas: number;
  totalObservaciones: number;
  observacionesAbiertas: number;
  observacionesCertificadas: number;
}

// Agrupa por HU: una HU está "abierta" si tiene al menos una observación
// que no está certificada; "certificada" si TODAS sus observaciones lo
// están. Se reusa tanto para el resumen en vivo como para guardar un corte.
export function calcularResumenPorHU(observaciones: ObservacionInventario[]): ResumenObservacionesHU {
  const porHU = new Map<number, ObservacionInventario[]>();
  for (const o of observaciones) {
    const lista = porHU.get(o.historia_usuario_id) || [];
    lista.push(o);
    porHU.set(o.historia_usuario_id, lista);
  }

  let huAbiertas = 0;
  let huCertificadas = 0;
  for (const obsDeHU of porHU.values()) {
    const todasCertificadas = obsDeHU.every((o) => o.estado === 'certificada');
    if (todasCertificadas) huCertificadas++;
    else huAbiertas++;
  }

  const observacionesCertificadas = observaciones.filter((o) => o.estado === 'certificada').length;

  return {
    totalHUConObservaciones: porHU.size,
    huAbiertas,
    huCertificadas,
    totalObservaciones: observaciones.length,
    observacionesAbiertas: observaciones.length - observacionesCertificadas,
    observacionesCertificadas,
  };
}

export async function guardarCorte(proyectoId: number): Promise<CorteObservaciones> {
  const observaciones = await inventarioObservacionesService.obtenerInventarioObservaciones(proyectoId);
  const resumen = calcularResumenPorHU(observaciones);

  const resultado = await executeProcedure<CorteObservaciones>('sp_guardar_corte_observaciones', [
    proyectoId,
    resumen.totalHUConObservaciones,
    resumen.huAbiertas,
    resumen.huCertificadas,
    resumen.totalObservaciones,
    resumen.observacionesAbiertas,
    resumen.observacionesCertificadas,
  ]);
  return resultado[0];
}

export async function listarCortes(proyectoId: number): Promise<CorteObservaciones[]> {
  return executeProcedure<CorteObservaciones>('sp_listar_cortes_observaciones', [proyectoId]);
}
