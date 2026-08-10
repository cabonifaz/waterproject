// lib/avanceCedula.ts
// Reporte "Avance Célula": real vs. planificado vs. baseline, por
// etapa/épica/tarea matriz. Fórmulas (deducidas de la plantilla de
// referencia del usuario):
//   % de Fase           = diasTotales fila / diasTotales proyecto
//   % Planificado        = diasPlanificados fila / diasTotales fila
//   % Real                = diasReales fila / diasTotales fila
//   % Cumplimiento       = diasReales fila / diasPlanificados fila
//   % Avance Planificado = diasPlanificados fila / diasTotales proyecto
//   % Avance Real         = diasReales fila / diasTotales proyecto
// "Días Totales" = el baseline (planificado inicial, capturado en el
// primer "Cerrar Planificado") — es el denominador fijo: no cambia con
// las re-planificaciones (Control de Cambios) ni con el avance real, así
// el % de Fase de cada fila se mantiene estable corte a corte.
//
// Semáforo = desviación de cronograma = 100% - % Cumplimiento:
//   sin días planificados -> negro (todavía no arrancó)
//   <= 5%  -> verde
//   > 5% y <= 8% -> amarillo
//   > 8%   -> rojo

import { EstructuraProyecto, EpicaConHU, TareaMatrizConDias, FilaAvanceCedula, Semaforo } from '@/types';

export type { Semaforo };

export interface FilaAvanceCalculada extends FilaAvanceCedula {
  porcentajeFase: number | null;
  porcentajePlanificado: number | null;
  porcentajeReal: number | null;
  porcentajeCumplimiento: number | null;
  porcentajeAvancePlanificado: number | null;
  porcentajeAvanceReal: number | null;
  semaforo: Semaforo;
}

function diasBaseline(dias: { tipo_marca: string }[]): number {
  return dias.filter((d) => d.tipo_marca !== 'cierre').length;
}

function diasEpicaBaseline(epica: EpicaConHU, campo: 'diasBaseline' | 'diasPlanificados' | 'diasReales'): number {
  return epica.historias.reduce((acc, h) => acc + diasBaseline(h[campo]), 0);
}

function diasTareaMatriz(t: TareaMatrizConDias, campo: 'diasBaseline' | 'diasPlanificados' | 'diasReales'): number {
  return diasBaseline(t[campo]);
}

// Filas "crudas" (sin porcentajes) — es lo que se guarda en un corte, y
// también lo que se recalcula en vivo para la vista previa.
export function construirFilasAvanceCedula(estructura: EstructuraProyecto): FilaAvanceCedula[] {
  const filas: FilaAvanceCedula[] = [];

  for (const etapa of estructura.etapas) {
    const hijos: FilaAvanceCedula[] = [];

    for (const t of etapa.tareasMatrices) {
      hijos.push({
        tipo: 'tarea_matriz',
        referenciaId: t.id,
        etapaNombre: etapa.nombre,
        nombre: t.titulo,
        esEncabezadoEtapa: false,
        diasTotales: diasTareaMatriz(t, 'diasBaseline'),
        diasPlanificados: diasTareaMatriz(t, 'diasPlanificados'),
        diasReales: diasTareaMatriz(t, 'diasReales'),
      });
    }

    for (const modulo of etapa.modulos) {
      for (const epica of modulo.epicas) {
        hijos.push({
          tipo: 'epica',
          referenciaId: epica.id,
          etapaNombre: etapa.nombre,
          nombre: epica.nombre,
          esEncabezadoEtapa: false,
          diasTotales: diasEpicaBaseline(epica, 'diasBaseline'),
          diasPlanificados: diasEpicaBaseline(epica, 'diasPlanificados'),
          diasReales: diasEpicaBaseline(epica, 'diasReales'),
        });
      }
    }

    const etapaFila: FilaAvanceCedula = {
      tipo: 'etapa',
      referenciaId: etapa.id,
      etapaNombre: etapa.nombre,
      nombre: etapa.nombre,
      esEncabezadoEtapa: true,
      diasTotales: hijos.reduce((acc, h) => acc + h.diasTotales, 0),
      diasPlanificados: hijos.reduce((acc, h) => acc + h.diasPlanificados, 0),
      diasReales: hijos.reduce((acc, h) => acc + h.diasReales, 0),
    };

    filas.push(etapaFila, ...hijos);
  }

  return filas;
}

export function porcentaje(parte: number, total: number): number | null {
  if (total <= 0) return null;
  return Math.round((parte / total) * 1000) / 10;
}

// Exportado también para el resumen liviano de la lista de proyectos
// (% cumplimiento + semáforo sin necesitar el baseline/Días Totales).
export function calcularSemaforo(diasPlanificados: number, porcentajeCumplimiento: number | null): Semaforo {
  if (diasPlanificados <= 0 || porcentajeCumplimiento == null) return 'negro';
  const desviacion = 100 - porcentajeCumplimiento;
  if (desviacion <= 5) return 'verde';
  if (desviacion <= 8) return 'amarillo';
  return 'rojo';
}

export function calcularFilasConPorcentajes(filas: FilaAvanceCedula[]): {
  filas: FilaAvanceCalculada[];
  totales: FilaAvanceCalculada;
} {
  // El total del proyecto es la suma de los "hijos" (no de los encabezados
  // de etapa, para no contar dos veces).
  const soloHijos = filas.filter((f) => !f.esEncabezadoEtapa);
  const totalDiasTotales = soloHijos.reduce((acc, f) => acc + f.diasTotales, 0);
  const totalDiasPlanificados = soloHijos.reduce((acc, f) => acc + f.diasPlanificados, 0);
  const totalDiasReales = soloHijos.reduce((acc, f) => acc + f.diasReales, 0);

  const calcularFila = (f: FilaAvanceCedula): FilaAvanceCalculada => {
    const porcentajeCumplimiento = porcentaje(f.diasReales, f.diasPlanificados);
    return {
      ...f,
      porcentajeFase: porcentaje(f.diasTotales, totalDiasTotales),
      porcentajePlanificado: porcentaje(f.diasPlanificados, f.diasTotales),
      porcentajeReal: porcentaje(f.diasReales, f.diasTotales),
      porcentajeCumplimiento,
      porcentajeAvancePlanificado: porcentaje(f.diasPlanificados, totalDiasTotales),
      porcentajeAvanceReal: porcentaje(f.diasReales, totalDiasTotales),
      semaforo: calcularSemaforo(f.diasPlanificados, porcentajeCumplimiento),
    };
  };

  const totales = calcularFila({
    tipo: 'etapa',
    referenciaId: 0,
    etapaNombre: '',
    nombre: '% Total de Avance del Proyecto',
    esEncabezadoEtapa: true,
    diasTotales: totalDiasTotales,
    diasPlanificados: totalDiasPlanificados,
    diasReales: totalDiasReales,
  });

  return { filas: filas.map(calcularFila), totales };
}
