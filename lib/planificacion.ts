// lib/planificacion.ts
// Cálculo de días (planificados y reales) y porcentajes, compartido entre
// la vista de estructura y los dos Gantt (planificado / real) para que
// todas las pantallas muestren siempre el mismo número. "Desarrollo"
// agrupa HU (desarrollo) + tareas matrices (trabajo) porque comparten el
// mismo modo de marcado (🟢 Desarrollo / Trabajo) en el Gantt;
// "Certificación" es solo de HU. Las mismas funciones sirven para
// planificado y real: solo cambia de qué campo (`diasPlanificados` o
// `diasReales`) se leen las marcas.

import { EstructuraProyecto, EtapaConContenido, EpicaConHU, DiaPlanificadoHU, DiaPlanificadoTareaMatriz } from '@/types';

export type CampoDias = 'diasPlanificados' | 'diasReales';

export interface TotalesDias {
  desarrollo: number;
  certificacion: number;
}

export function calcularTotalesDias(estructura: EstructuraProyecto, campo: CampoDias = 'diasPlanificados'): TotalesDias {
  let desarrollo = 0;
  let certificacion = 0;
  for (const etapa of estructura.etapas) {
    for (const t of etapa.tareasMatrices) {
      const dias = t[campo] as DiaPlanificadoTareaMatriz[];
      desarrollo += dias.filter((d) => d.tipo_marca === 'trabajo').length;
    }
    for (const modulo of etapa.modulos) {
      for (const epica of modulo.epicas) {
        for (const h of epica.historias) {
          const dias = h[campo] as DiaPlanificadoHU[];
          desarrollo += dias.filter((d) => d.tipo_marca === 'desarrollo').length;
          certificacion += dias.filter((d) => d.tipo_marca === 'certificacion').length;
        }
      }
    }
  }
  return { desarrollo, certificacion };
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
  for (const t of etapa.tareasMatrices) {
    dias += (t[campo] as DiaPlanificadoTareaMatriz[]).filter((d) => d.tipo_marca === 'trabajo').length;
  }
  for (const modulo of etapa.modulos) {
    for (const epica of modulo.epicas) {
      for (const h of epica.historias) {
        dias += (h[campo] as DiaPlanificadoHU[]).filter(
          (d) => d.tipo_marca === 'desarrollo' || d.tipo_marca === 'certificacion'
        ).length;
      }
    }
  }
  return dias;
}

export function diasEpicaFn(epica: EpicaConHU, campo: CampoDias = 'diasPlanificados'): number {
  return epica.historias.reduce(
    (acc, h) =>
      acc +
      (h[campo] as DiaPlanificadoHU[]).filter((d) => d.tipo_marca === 'desarrollo' || d.tipo_marca === 'certificacion')
        .length,
    0
  );
}

// Nombres previos, mantenidos para no tocar los call-sites ya existentes
// del Gantt/estructura planificados.
export const diasPlanificadosEtapa = (etapa: EtapaConContenido) => diasEtapa(etapa, 'diasPlanificados');
export const diasPlanificadosEpica = (epica: EpicaConHU) => diasEpicaFn(epica, 'diasPlanificados');
