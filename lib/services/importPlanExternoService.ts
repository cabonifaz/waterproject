// lib/services/importPlanExternoService.ts
// Importa un "Plan de Trabajo" externo (el formato de las hojas por
// célula: encabezado Mes/Sprint/Día en las filas 1-3, actividades desde
// la fila 4 en la columna B) — un formato DISTINTO al que genera esta app
// (ver importGanttExcelService, que hace el roundtrip del propio export).
//
// Cada fila de HU se identifica por el código "CF-NNN" embebido en el
// texto de la actividad (ej. "PS02 - CF-109: Búsqueda de empresa" -> el
// núcleo único es "CF109"; el prefijo "PSxx"/"PDxx" es solo la agrupación
// por épica, no es estable/único, así que se ignora para el matching).
// Ese núcleo se compara contra el código ya cargado de cada HU en la
// estructura del proyecto (mismo criterio de extracción de ambos lados,
// así no importa si un lado tiene guiones/espacios distintos).
//
// Las fechas de cada columna se reconstruyen desde el texto visible (mes
// en la fila 1, con el año embebido en alguna celda tipo "...PI2 2026";
// día+letra de la semana en la fila 3, ej. "V01", "L04") — no hay notas
// ocultas como en el formato propio, porque este archivo no lo generó la
// app. Se valida cada fecha contra la letra de día de semana esperada
// como chequeo de cordura (si no coincide, se usa igual pero se avisa).

import ExcelJS from 'exceljs';
import * as estructuraService from './estructuraService';
import { sincronizarFila, aFechaISO, ResultadoImportacionGantt } from './importGanttExcelService';

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];
const DIAS_SEMANA = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];

const COL_ACTIVIDAD = 2;
const COL_INICIO_DIAS = 4;
const FILA_MES = 1;
const FILA_DIA = 3;
const FILA_INICIO_DATOS = 4;

export interface ResultadoImportacionPlanExterno extends ResultadoImportacionGantt {
  filasConCodigo: number;
  huEncontradas: number;
  codigosNoEncontrados: string[];
}

// El único identificador estable de una HU en este formato es "CF-NNN" —
// el prefijo delante ("PS02", "PD01", ...) es la agrupación por épica y
// se repite entre varias HU, así que no sirve para matchear.
function extraerNucleoCodigo(texto: string): string | null {
  const m = /CF\s*-?\s*(\d+)/i.exec(texto);
  return m ? `CF${m[1]}` : null;
}

function tipoMarcaDesdeTexto(valor: string): string | null {
  const v = valor.trim().toLowerCase();
  if (v === 'h') return 'cierre';
  if (v === 'de') return 'desarrollo';
  if (v === 'us') return 'certificacion';
  return null;
}

interface ColumnaFecha {
  col: number;
  fecha: string;
}

function parsearColumnasFecha(hoja: ExcelJS.Worksheet, errores: string[]): ColumnaFecha[] {
  const columnas: ColumnaFecha[] = [];
  let anioActual: number | null = null;
  let mesAnterior = -1;

  for (let c = COL_INICIO_DIAS; c <= hoja.columnCount; c++) {
    const mesTexto = String(hoja.getCell(FILA_MES, c).value ?? '');
    const diaTexto = String(hoja.getCell(FILA_DIA, c).value ?? '').trim();

    const mAnio = /\b(20\d{2})\b/.exec(mesTexto);
    if (mAnio) anioActual = parseInt(mAnio[1], 10);

    const mesIdx = MESES.findIndex((m) => mesTexto.toLowerCase().includes(m));
    const mDia = /^([A-Za-zÁÉÍÓÚáéíóú])(\d{1,2})$/.exec(diaTexto);
    if (mesIdx === -1 || !mDia || anioActual == null) continue;

    // Si el mes retrocede respecto del anterior sin que la celda traiga un
    // año explícito, asumimos que cruzó de diciembre a enero.
    if (mesAnterior !== -1 && mesIdx < mesAnterior) anioActual++;
    mesAnterior = mesIdx;

    const numDia = parseInt(mDia[2], 10);
    const fecha = new Date(Date.UTC(anioActual, mesIdx, numDia));
    const letraEsperada = DIAS_SEMANA[fecha.getUTCDay()];
    if (mDia[1].toUpperCase() !== letraEsperada) {
      errores.push(
        `Columna ${c}: el día "${diaTexto}" no coincide con el día de semana calculado para ${fecha
          .toISOString()
          .slice(0, 10)} (debería ser "${letraEsperada}") — se usó igual.`
      );
    }

    columnas.push({ col: c, fecha: fecha.toISOString().slice(0, 10) });
  }

  return columnas;
}

interface FilaExcel {
  filaExcel: number;
  nucleo: string;
  marcas: Map<string, string>;
}

function parsearFilas(hoja: ExcelJS.Worksheet, columnas: ColumnaFecha[]): FilaExcel[] {
  const filas: FilaExcel[] = [];

  for (let r = FILA_INICIO_DATOS; r <= hoja.rowCount; r++) {
    const b = hoja.getCell(r, COL_ACTIVIDAD).value;
    if (!b || typeof b !== 'string') continue;
    const nucleo = extraerNucleoCodigo(b);
    if (!nucleo) continue; // fila de etapa/módulo/épica/tarea matriz/certificación agrupada — sin código de HU, se omite

    const marcas = new Map<string, string>();
    for (const col of columnas) {
      const valor = hoja.getCell(r, col.col).value;
      if (valor == null) continue;
      const tipo = tipoMarcaDesdeTexto(String(valor));
      if (tipo) marcas.set(col.fecha, tipo);
    }

    filas.push({ filaExcel: r, nucleo, marcas });
  }

  return filas;
}

export async function importarPlanExterno(
  proyectoId: number,
  archivo: Buffer,
  nombreHoja: string
): Promise<ResultadoImportacionPlanExterno> {
  const estructura = await estructuraService.obtenerEstructuraProyecto(proyectoId);
  if (!estructura) throw new Error('Proyecto no encontrado');
  if (estructura.proyecto.estado_planificacion !== 'abierto') {
    throw new Error('El planificado está cerrado — reactivalo (Control de Cambios) antes de importar.');
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(archivo as unknown as ExcelJS.Buffer);
  const hoja = workbook.getWorksheet(nombreHoja);
  if (!hoja) throw new Error(`No se encontró la hoja "${nombreHoja}" en el archivo.`);

  const resultado: ResultadoImportacionPlanExterno = {
    marcasAgregadas: 0,
    marcasQuitadas: 0,
    marcasSinCambios: 0,
    errores: [],
    filasConCodigo: 0,
    huEncontradas: 0,
    codigosNoEncontrados: [],
  };

  const columnas = parsearColumnasFecha(hoja, resultado.errores);
  if (columnas.length === 0) {
    throw new Error(
      'No se pudieron reconocer columnas de día en la hoja — se esperaba Mes en la fila 1 y Día (ej. "L04") en la fila 3.'
    );
  }

  const filasExcel = parsearFilas(hoja, columnas);
  resultado.filasConCodigo = filasExcel.length;

  const huPorNucleo = new Map<string, { id: number; actuales: Map<string, string> }>();
  for (const etapa of estructura.etapas) {
    for (const modulo of etapa.modulos) {
      for (const epica of modulo.epicas) {
        for (const h of epica.historias) {
          if (!h.codigo) continue;
          const nucleo = extraerNucleoCodigo(h.codigo);
          if (!nucleo) continue;
          const actuales = new Map(h.diasPlanificados.map((d) => [aFechaISO(d.fecha), d.tipo_marca]));
          huPorNucleo.set(nucleo, { id: h.id, actuales });
        }
      }
    }
  }

  const codigosNoEncontrados = new Set<string>();
  for (const fila of filasExcel) {
    const hu = huPorNucleo.get(fila.nucleo);
    if (!hu) {
      codigosNoEncontrados.add(fila.nucleo);
      continue;
    }
    resultado.huEncontradas++;
    await sincronizarFila('hu', hu.id, hu.actuales, fila.marcas, 'planificado', resultado);
  }
  resultado.codigosNoEncontrados = Array.from(codigosNoEncontrados);

  return resultado;
}
