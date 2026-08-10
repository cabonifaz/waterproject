// lib/services/importGanttExcelService.ts
// Importa un Gantt (Planificado o Real) completo desde el mismo .xlsx que
// genera exportarGanttComoExcel (lib/exportarGanttExcel.ts) — permite
// exportar, editar el archivo con Excel, y volver a subirlo para
// sincronizar la base de datos con lo que quedó marcado.
//
// Cada fila se identifica por una nota oculta "tipo:id" en la columna
// "Actividad", y cada columna de día por una nota oculta con la fecha ISO
// en el encabezado — así no depende de parsear texto visible ni de que
// las filas/columnas no se hayan reordenado.
//
// Solo se aplican los cambios (diff entre lo que ya hay en la BD y lo que
// trae el Excel), reusando el toggle de sp_marcar_dia_*: una celda que ya
// coincide no se toca (si se llamara al toggle igual, la "apagaría").

import ExcelJS from 'exceljs';
import * as estructuraService from './estructuraService';
import * as diasPlanificadosService from './diasPlanificadosService';
import * as diasRealesService from './diasRealesService';
import { DiaPlanificadoHU, DiaPlanificadoTareaMatriz, TipoMarcaHU, TipoMarcaTareaMatriz } from '@/types';

export type ModoImportacionGantt = 'planificado' | 'real';

export interface ResultadoImportacionGantt {
  marcasAgregadas: number;
  marcasQuitadas: number;
  marcasSinCambios: number;
  errores: string[];
}

const COL_ACTIVIDAD = 1;
const COL_INICIO_DIAS = 4;
const FILA_ENCABEZADO_DIAS = 3;
const FILA_INICIO_DATOS = 4;

type TipoFila = 'hu' | 'tareaMatriz';

interface FilaExcel {
  tipo: TipoFila;
  id: number;
  filaExcel: number;
  marcas: Map<string, string>; // fecha (yyyy-mm-dd) -> tipo_marca
}

function tipoMarcaDesdeTexto(valor: string, tipoFila: TipoFila): string | null {
  if (valor === 'H') return 'cierre';
  if (valor === 'DE') return tipoFila === 'tareaMatriz' ? 'trabajo' : 'desarrollo';
  if (valor === 'HU') return tipoFila === 'hu' ? 'certificacion' : null;
  return null;
}

function parsearHoja(hoja: ExcelJS.Worksheet, errores: string[]): FilaExcel[] {
  const fechaPorColumna = new Map<number, string>();
  for (let col = COL_INICIO_DIAS; col <= hoja.columnCount; col++) {
    const nota = hoja.getCell(FILA_ENCABEZADO_DIAS, col).note;
    const fecha = typeof nota === 'string' ? nota.trim() : null;
    if (fecha && /^\d{4}-\d{2}-\d{2}$/.test(fecha)) fechaPorColumna.set(col, fecha);
  }

  if (fechaPorColumna.size === 0) {
    errores.push('No se encontraron columnas de día reconocibles en el archivo — ¿es un Excel exportado por la app?');
    return [];
  }

  const filas: FilaExcel[] = [];
  for (let filaExcel = FILA_INICIO_DATOS; filaExcel <= hoja.rowCount; filaExcel++) {
    const nota = hoja.getCell(filaExcel, COL_ACTIVIDAD).note;
    const ref = typeof nota === 'string' ? nota.trim() : null;
    if (!ref) continue; // fila divisora (etapa/módulo/épica) u otra fila sin identidad

    const match = /^(hu|tareaMatriz):(\d+)$/.exec(ref);
    if (!match) continue;
    const tipo = match[1] as TipoFila;
    const id = Number(match[2]);

    const marcas = new Map<string, string>();
    for (const [col, fecha] of fechaPorColumna) {
      const valor = String(hoja.getCell(filaExcel, col).value ?? '').trim();
      if (!valor) continue;
      const tipoMarca = tipoMarcaDesdeTexto(valor, tipo);
      if (!tipoMarca) {
        if (valor === 'HU' && tipo === 'tareaMatriz') {
          errores.push(
            `Fila ${filaExcel} (tarea matriz ${id}), ${fecha}: la marca de certificación no aplica a tareas matrices, se ignora.`
          );
        }
        continue;
      }
      marcas.set(fecha, tipoMarca);
    }

    filas.push({ tipo, id, filaExcel, marcas });
  }

  return filas;
}

// Sincroniza una fila: quita lo que ya no está o cambió de tipo, agrega lo
// nuevo (días de trabajo antes que el cierre, para respetar "el cierre
// debe quedar como el último día"), y no toca lo que ya coincide.
async function sincronizarFila(
  tipo: TipoFila,
  id: number,
  actuales: Map<string, string>,
  deseadas: Map<string, string>,
  modo: ModoImportacionGantt,
  resultado: ResultadoImportacionGantt
): Promise<void> {
  const marcar = (fecha: string, tipoMarca: string) =>
    modo === 'planificado'
      ? tipo === 'hu'
        ? diasPlanificadosService.marcarDiaHU(id, fecha, tipoMarca as TipoMarcaHU)
        : diasPlanificadosService.marcarDiaTareaMatriz(id, fecha, tipoMarca as TipoMarcaTareaMatriz)
      : tipo === 'hu'
      ? diasRealesService.marcarDiaHURealidad(id, fecha, tipoMarca as TipoMarcaHU)
      : diasRealesService.marcarDiaTareaMatrizRealidad(id, fecha, tipoMarca as TipoMarcaTareaMatriz);

  for (const [fecha, tipoActual] of actuales) {
    if (deseadas.get(fecha) === tipoActual) continue;
    try {
      await marcar(fecha, tipoActual); // mismo tipo que el actual -> el toggle lo borra
      resultado.marcasQuitadas++;
    } catch (err) {
      resultado.errores.push(
        `${tipo}:${id} ${fecha}: no se pudo quitar la marca existente (${err instanceof Error ? err.message : 'error'}).`
      );
    }
  }

  const aAgregar = Array.from(deseadas.entries()).filter(([fecha, tipoDeseado]) => actuales.get(fecha) !== tipoDeseado);
  aAgregar.sort(([, a], [, b]) => (a === 'cierre' ? 1 : 0) - (b === 'cierre' ? 1 : 0));

  for (const [fecha, tipoDeseado] of aAgregar) {
    try {
      await marcar(fecha, tipoDeseado);
      resultado.marcasAgregadas++;
    } catch (err) {
      resultado.errores.push(
        `${tipo}:${id} ${fecha}: no se pudo marcar "${tipoDeseado}" (${err instanceof Error ? err.message : 'error'}).`
      );
    }
  }

  for (const [fecha, tipoActual] of actuales) {
    if (deseadas.get(fecha) === tipoActual) resultado.marcasSinCambios++;
  }
}

export async function importarGanttExcel(
  proyectoId: number,
  archivo: Buffer,
  modo: ModoImportacionGantt
): Promise<ResultadoImportacionGantt> {
  const estructura = await estructuraService.obtenerEstructuraProyecto(proyectoId);
  if (!estructura) throw new Error('Proyecto no encontrado');

  if (modo === 'planificado' && estructura.proyecto.estado_planificacion !== 'abierto') {
    throw new Error('El planificado está cerrado — reactivalo (Control de Cambios) antes de importar.');
  }
  if (modo === 'real' && estructura.proyecto.estado_planificacion !== 'cerrado') {
    throw new Error('Cerrá el planificado primero (Control de Cambios) para poder importar el real.');
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(archivo as unknown as ExcelJS.Buffer);
  const hoja = workbook.worksheets[0];
  if (!hoja) throw new Error('El Excel no tiene ninguna hoja');

  const resultado: ResultadoImportacionGantt = { marcasAgregadas: 0, marcasQuitadas: 0, marcasSinCambios: 0, errores: [] };
  const filasExcel = parsearHoja(hoja, resultado.errores);

  // ¡Ojo! `estructuraService` corre server-side, sin pasar por el JSON de
  // una respuesta HTTP — mysql2 devuelve las columnas DATE como objetos
  // Date reales (no strings), aunque el tipo declare `fecha: string`.
  // `String(fechaDate)` da el formato largo de Date.toString() (p. ej.
  // "Tue Aug 18 2026..."), no ISO — hay que pasar por `new Date(...)`.
  const aFechaISO = (fecha: string | Date): string => new Date(fecha).toISOString().slice(0, 10);

  const huIndex = new Map<number, Map<string, string>>();
  const tmIndex = new Map<number, Map<string, string>>();
  const campo = modo === 'planificado' ? 'diasPlanificados' : 'diasReales';
  for (const etapa of estructura.etapas) {
    for (const t of etapa.tareasMatrices) {
      const dias = t[campo] as DiaPlanificadoTareaMatriz[];
      tmIndex.set(t.id, new Map(dias.map((d) => [aFechaISO(d.fecha), d.tipo_marca])));
    }
    for (const modulo of etapa.modulos) {
      for (const epica of modulo.epicas) {
        for (const h of epica.historias) {
          const dias = h[campo] as DiaPlanificadoHU[];
          huIndex.set(h.id, new Map(dias.map((d) => [aFechaISO(d.fecha), d.tipo_marca])));
        }
      }
    }
  }

  for (const filaExcel of filasExcel) {
    const actuales = filaExcel.tipo === 'hu' ? huIndex.get(filaExcel.id) : tmIndex.get(filaExcel.id);
    if (!actuales) {
      resultado.errores.push(
        `Fila ${filaExcel.filaExcel} (${filaExcel.tipo}:${filaExcel.id}): no pertenece a este proyecto, se omite.`
      );
      continue;
    }
    await sincronizarFila(filaExcel.tipo, filaExcel.id, actuales, filaExcel.marcas, modo, resultado);
  }

  return resultado;
}
