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
// Semáforo — distingue dos casos, porque medir solo "100% - %Cumplimiento"
// no alcanza: si una actividad lleva MÁS días reales que planificados y
// todavía no cerró, esa desviación da negativa y el chequeo "<=5% -> verde"
// la mostraba en verde (el peor caso posible pasando como el mejor).
//   - Sin actividades planificadas -> negro (todavía no arrancó).
//   - Actividad(es) SIN cerrar (queda alguna abierta): lo que importa es si
//     ya se consumió el presupuesto de días sin terminar.
//       % consumido = diasReales / diasPlanificados
//       <= 80%  -> verde (normal, dentro de presupuesto)
//       <= 100% -> amarillo (cerca del límite, alerta temprana)
//       > 100%  -> rojo (ya se pasó del estimado y sigue sin cerrar: atraso real)
//   - Todas las actividades CERRADAS: mide qué tan lejos terminó del
//     estimado, en cualquier dirección (se pasó o cerró antes de tiempo).
//       desviación = |% consumido - 100|
//       <= 5%  -> verde
//       <= 8%  -> amarillo
//       > 8%   -> rojo

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

function tieneCierreReal(diasReales: { tipo_marca: string }[]): boolean {
  return diasReales.some((d) => d.tipo_marca === 'cierre');
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
        totalActividades: 1,
        actividadesCerradas: tieneCierreReal(t.diasReales) ? 1 : 0,
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
          totalActividades: epica.historias.length,
          actividadesCerradas: epica.historias.filter((h) => tieneCierreReal(h.diasReales)).length,
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
      totalActividades: hijos.reduce((acc, h) => acc + h.totalActividades, 0),
      actividadesCerradas: hijos.reduce((acc, h) => acc + h.actividadesCerradas, 0),
    };

    filas.push(etapaFila, ...hijos);
  }

  return filas;
}

export function porcentaje(parte: number, total: number): number | null {
  if (total <= 0) return null;
  return Math.round((parte / total) * 1000) / 10;
}

// Exportado también para el resumen liviano de la lista de proyectos y
// para el semáforo por fila del Gantt Real.
export function calcularSemaforo(diasPlanificados: number, diasReales: number, cerrada: boolean): Semaforo {
  if (diasPlanificados <= 0) return 'negro';
  const pctConsumido = (diasReales / diasPlanificados) * 100;

  if (!cerrada) {
    if (pctConsumido > 100) return 'rojo'; // ya se pasó del estimado y sigue sin cerrar
    if (pctConsumido >= 80) return 'amarillo'; // cerca del límite, alerta temprana
    return 'verde';
  }

  const desviacion = Math.abs(pctConsumido - 100);
  if (desviacion <= 5) return 'verde';
  if (desviacion <= 8) return 'amarillo';
  return 'rojo';
}

// Mientras una actividad sigue abierta, un % basado en días reales todavía
// no es un "% de avance" real (solo dice cuánto presupuesto de días se
// gastó, y puede pasar de 100% sin que esté ni cerca de terminar) — así
// que se topea a 100% para no mostrar un número que se lee como "más que
// terminado" para algo que sigue en curso. El atraso real se sigue viendo
// en el semáforo (que sí usa el consumo real, sin topear) y, una vez que
// la actividad cierra, el % ya refleja el valor final tal cual (sin tope).
export function topePorcentaje(valor: number | null, cerrada: boolean): number | null {
  if (valor == null || cerrada) return valor;
  return Math.min(valor, 100);
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
  const totalActividadesProyecto = soloHijos.reduce((acc, f) => acc + f.totalActividades, 0);
  const totalActividadesCerradasProyecto = soloHijos.reduce((acc, f) => acc + f.actividadesCerradas, 0);

  const calcularFila = (f: FilaAvanceCedula): FilaAvanceCalculada => {
    const cerrada = f.totalActividades > 0 && f.actividadesCerradas === f.totalActividades;
    return {
      ...f,
      porcentajeFase: porcentaje(f.diasTotales, totalDiasTotales),
      porcentajePlanificado: porcentaje(f.diasPlanificados, f.diasTotales),
      porcentajeReal: topePorcentaje(porcentaje(f.diasReales, f.diasTotales), cerrada),
      porcentajeCumplimiento: topePorcentaje(porcentaje(f.diasReales, f.diasPlanificados), cerrada),
      porcentajeAvancePlanificado: porcentaje(f.diasPlanificados, totalDiasTotales),
      porcentajeAvanceReal: topePorcentaje(porcentaje(f.diasReales, totalDiasTotales), cerrada),
      semaforo: calcularSemaforo(f.diasPlanificados, f.diasReales, cerrada),
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
    totalActividades: totalActividadesProyecto,
    actividadesCerradas: totalActividadesCerradasProyecto,
  });

  return { filas: filas.map(calcularFila), totales };
}
