// lib/planificacion.ts
// Cálculo de días (planificados y reales) y porcentajes, compartido entre
// la vista de estructura y los dos Gantt (planificado / real) para que
// todas las pantallas muestren siempre el mismo número. "Desarrollo"
// agrupa HU (desarrollo) + tareas matrices (trabajo) porque comparten el
// mismo modo de marcado (🟢 Desarrollo / Trabajo) en el Gantt;
// "Certificación" es solo de HU. El día de hito (H) TAMBIÉN cuenta como
// día de la actividad (se trabaja ese día): se suma aparte en `hitos` y
// entra en el total. Las mismas funciones sirven para planificado y real:
// solo cambia de qué campo (`diasPlanificados` o `diasReales`) se leen.

import { EstructuraProyecto, EtapaConContenido, EpicaConHU, DiaPlanificadoHU, DiaPlanificadoTareaMatriz } from '@/types';

export type CampoDias = 'diasPlanificados' | 'diasReales';

export interface TotalesDias {
  desarrollo: number;
  certificacion: number;
  hitos: number;
}

export const totalDias = (t: TotalesDias): number => t.desarrollo + t.certificacion + t.hitos;

export const TOTALES_VACIOS: TotalesDias = { desarrollo: 0, certificacion: 0, hitos: 0 };

// Días de una actividad: todas sus marcas (trabajo/desarrollo,
// certificación y el día del hito).
export function contarDias(dias: { tipo_marca: string }[]): number {
  return dias.length;
}

export function calcularTotalesDias(estructura: EstructuraProyecto, campo: CampoDias = 'diasPlanificados'): TotalesDias {
  let desarrollo = 0;
  let certificacion = 0;
  let hitos = 0;
  for (const etapa of estructura.etapas) {
    for (const t of etapa.tareasMatrices) {
      const dias = t[campo] as DiaPlanificadoTareaMatriz[];
      desarrollo += dias.filter((d) => d.tipo_marca === 'trabajo').length;
      hitos += dias.filter((d) => d.tipo_marca === 'cierre').length;
    }
    for (const modulo of etapa.modulos) {
      for (const epica of modulo.epicas) {
        for (const h of epica.historias) {
          const dias = h[campo] as DiaPlanificadoHU[];
          desarrollo += dias.filter((d) => d.tipo_marca === 'desarrollo').length;
          certificacion += dias.filter((d) => d.tipo_marca === 'certificacion').length;
          hitos += dias.filter((d) => d.tipo_marca === 'cierre').length;
        }
      }
    }
  }
  return { desarrollo, certificacion, hitos };
}

// Alias explícito, más legible en los call-sites del planificado.
export const calcularTotalesPlanificados = (estructura: EstructuraProyecto): TotalesDias =>
  calcularTotalesDias(estructura, 'diasPlanificados');

export function calcularPorcentaje(dias: number, total: number): number | null {
  if (total <= 0) return null;
  return Math.round((dias / total) * 1000) / 10;
}

export function diasEtapa(etapa: EtapaConContenido, campo: CampoDias = 'diasPlanificados'): number {
  let dias = 0;
  for (const t of etapa.tareasMatrices) dias += contarDias(t[campo]);
  for (const modulo of etapa.modulos) {
    for (const epica of modulo.epicas) dias += diasEpicaFn(epica, campo);
  }
  return dias;
}

export function diasEpicaFn(epica: EpicaConHU, campo: CampoDias = 'diasPlanificados'): number {
  return epica.historias.reduce((acc, h) => acc + contarDias(h[campo]), 0);
}

// Nombres previos, mantenidos para no tocar los call-sites ya existentes
// del Gantt/estructura planificados.
export const diasPlanificadosEtapa = (etapa: EtapaConContenido) => diasEtapa(etapa, 'diasPlanificados');
export const diasPlanificadosEpica = (epica: EpicaConHU) => diasEpicaFn(epica, 'diasPlanificados');
