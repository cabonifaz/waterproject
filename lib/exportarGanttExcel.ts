// lib/exportarGanttExcel.ts
// Exporta el Gantt (Planificado o Real) completo a un .xlsx editable —
// todos los sprints y todas las filas, en el mismo orden que en pantalla,
// con los mismos colores. Corre en el navegador (exceljs también funciona
// del lado del cliente).
//
// Los colores de las marcas NO se pintan fijos: son reglas de formato
// condicional sobre el texto de la celda ("DE" desarrollo/trabajo, "HU"
// certificación, "H" hito), igual que en el front — si se edita el Excel
// (se escribe o borra una marca), la celda se recolorea sola. Lo mismo
// los totales: días, H, % de cumplimiento y semáforo son fórmulas con
// formato condicional, y se recalculan al editar.
//
// El archivo se puede volver a importar (importGanttExcelService): las
// filas se identifican por la nota "tipo:id" de la columna Actividad y
// los días por la nota con la fecha ISO del encabezado — las columnas de
// totales del medio no tienen nota y el importador las ignora.

'use client';

import type { Worksheet, Workbook } from 'exceljs';

export interface ColumnaExcel {
  fecha: string;
  mesLabel: string;
  grupoLabel: string;
  diaSemana: string;
  diaMes: number;
  esFeriado: boolean;
  esInicioGrupo: boolean;
  esHoy?: boolean;
}

export type NivelDivisorExcel = 'etapa' | 'modulo' | 'epica';

export type ItemExcel =
  | { kind: 'divisor'; nivel: NivelDivisorExcel; label: string }
  | {
      kind: 'fila';
      tipo: string;
      id: number;
      etiqueta: string;
      contexto: string;
      fechaCierre?: string;
      miembros: string;
      esActividadCierre?: boolean;
      diasPlanificados?: number; // solo Real: referencia para el % de cumplimiento
    };

export interface ExportarGanttOpciones {
  nombreArchivo: string;
  nombreHoja: string;
  columnas: ColumnaExcel[];
  items: ItemExcel[];
  marcas: Map<string, string>;
  // Solo Gantt Real: se dibuja como borde de referencia sobre la marca
  // real, para poder comparar en la misma celda.
  marcasPlanificadas?: Map<string, string>;
}

export const COLOR = {
  etapaFondo: 'FF172554',
  etapaTexto: 'FFFFFFFF',
  moduloFondo: 'FFC7D2FE',
  moduloTexto: 'FF312E81',
  epicaFondo: 'FFDBEAFE',
  epicaTexto: 'FF1E3A8A',
  grupoFondo: 'FFDCFCE7',
  grupoTexto: 'FF14532D',
  diaFondo: 'FFF1F5F9',
  diaTexto: 'FF334155',
  feriadoFondo: 'FFFED7AA',
  feriadoTexto: 'FF9A3412',
  hoyFondo: 'FF9333EA',
  hoyTexto: 'FFFFFFFF',
  hoyCelda: 'FFF3E8FF',
  desarrollo: 'FF22C55E',
  certificacion: 'FFFB923C',
  cierre: 'FF2563EB',
  celdaFeriado: 'FFFFEDD5',
  cierreFuncionalidad: 'FFFFFBEB',
  blanco: 'FFFFFFFF',
  borde: 'FF475569', // slate-600: bordes bien visibles al imprimir/ver en Excel
  semaforoVerde: 'FF22C55E',
  semaforoAmarillo: 'FFEAB308',
  semaforoRojo: 'FFEF4444',
  semaforoNegro: 'FF374151',
} as const;

const MARCA_COLOR: Record<string, string> = {
  desarrollo: COLOR.desarrollo,
  trabajo: COLOR.desarrollo,
  certificacion: COLOR.certificacion,
  cierre: COLOR.cierre,
};

// Texto que va en cada celda-día según la marca (lo que lee el importador
// y lo que dispara el formato condicional).
const TEXTO_MARCA: Record<string, string> = {
  desarrollo: 'DE',
  trabajo: 'DE',
  certificacion: 'HU',
  cierre: 'H',
};

function claveMarca(tipo: string, id: number, fecha: string): string {
  return `${tipo}-${id}-${fecha}`;
}

function agruparConsecutivos<T>(items: T[], campo: (item: T) => string): { label: string; cantidad: number }[] {
  const grupos: { label: string; cantidad: number }[] = [];
  for (const item of items) {
    const label = campo(item);
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.label === label) ultimo.cantidad++;
    else grupos.push({ label, cantidad: 1 });
  }
  return grupos;
}

export function fillSolido(argb: string) {
  return { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb } };
}

// En el formato condicional, Excel toma el color de relleno de bgColor.
export function estiloCondicional(fondo: string, texto: string, negrita = false) {
  return {
    fill: { type: 'pattern' as const, pattern: 'solid' as const, bgColor: { argb: fondo } },
    font: { color: { argb: texto }, bold: negrita },
  };
}

export function bordeFino(argb: string = COLOR.borde) {
  const estilo = { style: 'thin' as const, color: { argb } };
  return { top: estilo, left: estilo, bottom: estilo, right: estilo };
}

const COLOR_BORDE_MES = 'FF0F172A'; // slate-900, el separador más marcado
const COLOR_BORDE_SPRINT = 'FF334155'; // slate-700
const COLOR_BORDE_HOY = 'FF9333EA';

// Borde de una celda-día: el lado izquierdo marca el inicio de mes (más
// grueso) o de sprint (grueso) — igual que el border-l-4 / border-l-2 en
// pantalla —, la columna de HOY lleva los costados violetas, y los demás
// lados quedan finos o con el color de la marca planificada de
// referencia (solo Gantt Real) si aplica.
function bordeColumnaDia(esInicioMes: boolean, esInicioGrupo: boolean, esHoy: boolean, colorReferencia?: string) {
  const ladoReferencia = colorReferencia
    ? { style: 'medium' as const, color: { argb: colorReferencia } }
    : { style: 'thin' as const, color: { argb: COLOR.borde } };
  const ladoHoy = { style: 'medium' as const, color: { argb: COLOR_BORDE_HOY } };

  const ladoIzquierdo = esInicioMes
    ? { style: 'thick' as const, color: { argb: COLOR_BORDE_MES } }
    : esInicioGrupo
    ? { style: 'medium' as const, color: { argb: COLOR_BORDE_SPRINT } }
    : esHoy
    ? ladoHoy
    : ladoReferencia;

  return {
    top: ladoReferencia,
    bottom: ladoReferencia,
    right: esHoy ? ladoHoy : ladoReferencia,
    left: ladoIzquierdo,
  };
}

export async function descargarWorkbook(workbook: Workbook, nombreArchivo: string): Promise<void> {
  // Que Excel recalcule todas las fórmulas al abrir (exceljs no las calcula).
  workbook.calcProperties.fullCalcOnLoad = true;
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${nombreArchivo}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function exportarGanttComoExcel(opciones: ExportarGanttOpciones): Promise<void> {
  const ExcelJS = (await import('exceljs')).default;
  const { columnas, items, marcas, marcasPlanificadas, nombreArchivo, nombreHoja } = opciones;
  const esReal = marcasPlanificadas != null;

  const workbook = new ExcelJS.Workbook();

  // Columnas fijas (izquierda):
  //   Planificado: A Actividad · B H · C Talentos · D Días
  //   Real:        A Actividad · B H · C Talentos · D Días Plan. · E Días Real · F % Cumpl. · G Cerrada
  const FIJAS = esReal
    ? ['Actividad', 'H', 'Talentos', 'Días Plan.', 'Días Real', '% Cumpl.', 'Cerrada']
    : ['Actividad', 'H', 'Talentos', 'Días'];
  const COL_INICIO_DIAS = FIJAS.length + 1;
  const COL_FIN_DIAS = COL_INICIO_DIAS + Math.max(columnas.length, 1) - 1;

  const hoja: Worksheet = workbook.addWorksheet(nombreHoja, {
    views: [{ state: 'frozen', xSplit: FIJAS.length, ySplit: 3 }],
  });
  const letra = (col: number) => hoja.getColumn(col).letter;
  const L_INI = letra(COL_INICIO_DIAS);
  const L_FIN = letra(COL_FIN_DIAS);

  const inicioMes = columnas.map((c, i) => i === 0 || c.mesLabel !== columnas[i - 1].mesLabel);

  const aplicarBordesDia = (filaExcel: number, colorReferencia?: (i: number) => string | undefined) => {
    columnas.forEach((c, i) => {
      hoja.getCell(filaExcel, COL_INICIO_DIAS + i).border = bordeColumnaDia(
        inicioMes[i],
        c.esInicioGrupo,
        !!c.esHoy,
        colorReferencia?.(i)
      );
    });
  };

  hoja.getColumn(1).width = 46;
  hoja.getColumn(2).width = 6;
  hoja.getColumn(3).width = 14;
  for (let col = 4; col < COL_INICIO_DIAS; col++) hoja.getColumn(col).width = 9;
  for (let i = 0; i < columnas.length; i++) hoja.getColumn(COL_INICIO_DIAS + i).width = 5;

  // --- Encabezados (3 filas: meses, sprints, días) ---
  FIJAS.forEach((titulo, k) => {
    hoja.mergeCells(1, k + 1, 3, k + 1);
    const c = hoja.getCell(1, k + 1);
    c.value = titulo;
    c.fill = fillSolido(COLOR.diaFondo);
    c.font = { bold: true, size: 9 };
    c.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    c.border = bordeFino();
  });

  let colCursor = COL_INICIO_DIAS;
  for (const g of agruparConsecutivos(columnas, (c) => c.mesLabel)) {
    hoja.mergeCells(1, colCursor, 1, colCursor + g.cantidad - 1);
    const cell = hoja.getCell(1, colCursor);
    cell.value = g.label;
    cell.fill = fillSolido(COLOR.grupoFondo);
    cell.font = { bold: true, color: { argb: COLOR.grupoTexto } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    colCursor += g.cantidad;
  }
  aplicarBordesDia(1);

  colCursor = COL_INICIO_DIAS;
  for (const g of agruparConsecutivos(columnas, (c) => c.grupoLabel)) {
    hoja.mergeCells(2, colCursor, 2, colCursor + g.cantidad - 1);
    const cell = hoja.getCell(2, colCursor);
    cell.value = g.label;
    cell.fill = fillSolido(COLOR.grupoFondo);
    cell.font = { bold: true, color: { argb: COLOR.grupoTexto } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    colCursor += g.cantidad;
  }
  aplicarBordesDia(2);

  columnas.forEach((c, i) => {
    const cell = hoja.getCell(3, COL_INICIO_DIAS + i);
    cell.value = c.esHoy ? 'HOY' : `${c.diaSemana}${String(c.diaMes).padStart(2, '0')}`;
    cell.fill = fillSolido(c.esHoy ? COLOR.hoyFondo : c.esFeriado ? COLOR.feriadoFondo : COLOR.diaFondo);
    cell.font = {
      bold: true,
      size: 8,
      color: { argb: c.esHoy ? COLOR.hoyTexto : c.esFeriado ? COLOR.feriadoTexto : COLOR.diaTexto },
    };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    // Nota oculta con la fecha ISO exacta — así se puede reimportar este
    // mismo archivo sin depender de parsear el texto visible de la celda.
    cell.note = c.fecha;
  });
  aplicarBordesDia(3);

  // --- Filas de datos ---
  let fila = 4;
  const ESTILO_DIVISOR: Record<NivelDivisorExcel, { fondo: string; texto: string }> = {
    etapa: { fondo: COLOR.etapaFondo, texto: COLOR.etapaTexto },
    modulo: { fondo: COLOR.moduloFondo, texto: COLOR.moduloTexto },
    epica: { fondo: COLOR.epicaFondo, texto: COLOR.epicaTexto },
  };

  for (const item of items) {
    if (item.kind === 'divisor') {
      const estilo = ESTILO_DIVISOR[item.nivel];
      hoja.mergeCells(fila, 1, fila, FIJAS.length);
      const label = hoja.getCell(fila, 1);
      label.value = item.label;
      label.fill = fillSolido(estilo.fondo);
      label.font = { bold: true, color: { argb: estilo.texto }, size: 10 };
      label.alignment = { vertical: 'middle', indent: item.nivel === 'epica' ? 2 : item.nivel === 'modulo' ? 1 : 0 };
      label.border = bordeFino();

      if (columnas.length > 0) {
        hoja.mergeCells(fila, COL_INICIO_DIAS, fila, COL_FIN_DIAS);
        const barra = hoja.getCell(fila, COL_INICIO_DIAS);
        barra.fill = fillSolido(estilo.fondo);
        barra.border = bordeFino();
      }

      hoja.getRow(fila).height = 18;
      fila++;
      continue;
    }

    const f = item;
    const rango = `$${L_INI}${fila}:$${L_FIN}${fila}`;
    const fondoFijas = f.esActividadCierre ? COLOR.cierreFuncionalidad : COLOR.blanco;

    const celdaAct = hoja.getCell(fila, 1);
    celdaAct.value = (f.esActividadCierre ? '🏁 ' : '') + f.etiqueta;
    celdaAct.alignment = { indent: 2, vertical: 'middle', wrapText: true };
    celdaAct.font = { size: 9 };
    // Nota oculta con la identidad real de la fila (tipo:id) — permite
    // reimportar este archivo identificando cada fila aunque se reordenen
    // o edite el texto de la etiqueta.
    celdaAct.note = `${f.tipo}:${f.id}`;

    // H: cantidad de hitos de la fila ("H", o "H×N" si hay varios).
    const conteoH = `COUNTIF(${rango},"H")`;
    hoja.getCell(fila, 2).value = {
      formula: `IF(${conteoH}=0,"",IF(${conteoH}=1,"H","H×"&${conteoH}))`,
    };
    hoja.getCell(fila, 2).alignment = { horizontal: 'center', vertical: 'middle' };
    hoja.getCell(fila, 2).font = { bold: true, size: 9 };
    if (f.fechaCierre) hoja.getCell(fila, 2).note = esReal ? `Cierre real: ${f.fechaCierre}` : `Fecha comprometida: ${f.fechaCierre}`;

    hoja.getCell(fila, 3).value = f.miembros;
    hoja.getCell(fila, 3).font = { size: 8 };
    hoja.getCell(fila, 3).alignment = { horizontal: 'center', vertical: 'middle' };

    const conteoDias = `COUNTIF(${rango},"DE")+COUNTIF(${rango},"HU")`;
    if (esReal) {
      hoja.getCell(fila, 4).value = f.diasPlanificados ?? 0;
      hoja.getCell(fila, 5).value = { formula: conteoDias };
      // Cerrada = el último día marcado de la fila es un hito (mismo
      // criterio que lib/hitos.ts).
      hoja.getCell(fila, 7).value = {
        formula: `IF(IFERROR(LOOKUP(2,1/(${rango}<>""),${rango}),"")="H","Sí","No")`,
      };
      // % cumplimiento = reales / planificados; topeado a 100% mientras
      // sigue abierta (igual que topePorcentaje en lib/avanceCedula.ts).
      hoja.getCell(fila, 6).value = {
        formula: `IF(D${fila}=0,"—",IF(G${fila}="Sí",E${fila}/D${fila},MIN(E${fila}/D${fila},1)))`,
      };
      hoja.getCell(fila, 6).numFmt = '0.0%';
      hoja.getCell(fila, 6).font = { bold: true, size: 9 };
    } else {
      hoja.getCell(fila, 4).value = { formula: conteoDias };
    }

    for (let col = 1; col < COL_INICIO_DIAS; col++) {
      const c = hoja.getCell(fila, col);
      c.border = bordeFino();
      if (col > 1) c.alignment = { horizontal: 'center', vertical: 'middle' };
      if (col !== 2) c.fill = fillSolido(fondoFijas);
    }

    columnas.forEach((c, i) => {
      const cell = hoja.getCell(fila, COL_INICIO_DIAS + i);
      const marca = marcas.get(claveMarca(f.tipo, f.id, c.fecha));
      const marcaPlan = marcasPlanificadas?.get(claveMarca(f.tipo, f.id, c.fecha));
      // Fondo base (feriado / hoy / blanco); el color de la marca lo pone
      // el formato condicional según el texto de la celda.
      cell.fill = fillSolido(c.esFeriado ? COLOR.celdaFeriado : c.esHoy ? COLOR.hoyCelda : COLOR.blanco);
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.font = { size: 8 };
      if (marca) cell.value = TEXTO_MARCA[marca];
      if (marcaPlan) cell.note = `Planificado: ${marcaPlan === 'cierre' ? 'hito (fecha comprometida)' : marcaPlan}`;
    });

    aplicarBordesDia(fila, (i) => {
      const marcaPlan = marcasPlanificadas?.get(claveMarca(f.tipo, f.id, columnas[i].fecha));
      return marcaPlan ? MARCA_COLOR[marcaPlan] : undefined;
    });

    hoja.getRow(fila).height = 30;
    fila++;
  }

  const ultimaFila = Math.max(fila - 1, 4);

  // --- Reglas de coloración (formato condicional), como en el front ---
  if (columnas.length > 0) {
    // Marcas: "DE" verde y "HU" naranja con el texto del mismo color (no se
    // ve la letra, pero sirve para contar); "H" azul con la letra blanca.
    hoja.addConditionalFormatting({
      ref: `${L_INI}4:${L_FIN}${ultimaFila}`,
      rules: [
        { type: 'cellIs', operator: 'equal', formulae: ['"DE"'], priority: 1, style: estiloCondicional(COLOR.desarrollo, COLOR.desarrollo) },
        { type: 'cellIs', operator: 'equal', formulae: ['"HU"'], priority: 2, style: estiloCondicional(COLOR.certificacion, COLOR.certificacion) },
        { type: 'cellIs', operator: 'equal', formulae: ['"H"'], priority: 3, style: estiloCondicional(COLOR.cierre, COLOR.blanco, true) },
      ],
    });
  }

  // Columna H: en el Real, relleno azul si la actividad cerró y solo la
  // letra azul si tiene hitos pero sigue abierta (como en el front). En el
  // Planificado (fecha comprometida) siempre relleno azul.
  hoja.addConditionalFormatting({
    ref: `B4:B${ultimaFila}`,
    rules: esReal
      ? [
          { type: 'expression', formulae: ['AND($B4<>"",$G4="Sí")'], priority: 4, style: estiloCondicional(COLOR.cierre, COLOR.blanco, true) },
          { type: 'expression', formulae: ['AND($B4<>"",$G4<>"Sí")'], priority: 5, style: estiloCondicional(COLOR.blanco, COLOR.cierre, true) },
        ]
      : [{ type: 'expression', formulae: ['$B4<>""'], priority: 4, style: estiloCondicional(COLOR.cierre, COLOR.blanco, true) }],
  });

  if (esReal) {
    // Semáforo sobre el % de cumplimiento — mismas reglas que
    // calcularSemaforo (lib/avanceCedula.ts):
    //   sin días planificados -> negro
    //   abierta: >100% rojo, >=80% amarillo, si no verde
    //   cerrada: desvío |real/plan - 100%| <=5% verde, <=8% amarillo, si no rojo
    const r = 'ROUND($E4/$D4,4)';
    const abierta = '$G4<>"Sí"';
    const cerrada = '$G4="Sí"';
    hoja.addConditionalFormatting({
      ref: `F4:F${ultimaFila}`,
      rules: [
        { type: 'expression', formulae: ['AND(ISNUMBER($D4),$D4=0)'], priority: 6, style: estiloCondicional(COLOR.semaforoNegro, COLOR.blanco, true) },
        {
          type: 'expression',
          formulae: [`AND($D4>0,OR(AND(${abierta},${r}>1),AND(${cerrada},ABS(${r}-1)>0.08)))`],
          priority: 7,
          style: estiloCondicional(COLOR.semaforoRojo, COLOR.blanco, true),
        },
        {
          type: 'expression',
          formulae: [`AND($D4>0,OR(AND(${abierta},${r}>=0.8),AND(${cerrada},ABS(${r}-1)>0.05)))`],
          priority: 8,
          style: estiloCondicional(COLOR.semaforoAmarillo, COLOR.blanco, true),
        },
        { type: 'expression', formulae: ['$D4>0'], priority: 9, style: estiloCondicional(COLOR.semaforoVerde, COLOR.blanco, true) },
      ],
    });
  }

  await descargarWorkbook(workbook, nombreArchivo);
}
