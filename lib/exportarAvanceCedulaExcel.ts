// lib/exportarAvanceCedulaExcel.ts
// Exporta el reporte "Avance Célula" a .xlsx con las mismas filas y en el
// mismo orden que en pantalla (etapa -> tareas matrices -> épicas /
// funcionalidades). Los porcentajes y el semáforo son fórmulas, con las
// mismas reglas que lib/avanceCedula.ts, y los colores del semáforo y del
// Δ son formato condicional: si se corrigen los días en el Excel, todo se
// recalcula y se recolorea solo.

'use client';

import { FilaAvanceCalculada } from './avanceCedula';
import { COLOR, bordeFino, descargarWorkbook, estiloCondicional, fillSolido } from './exportarGanttExcel';

export interface ExportarAvanceCedulaOpciones {
  nombreArchivo: string;
  titulo: string;
  filas: FilaAvanceCalculada[];
  totalNombre: string;
  // Δ de % Avance Real vs. el corte anterior, en puntos porcentuales, por
  // índice de fila (null = sin corte anterior); `deltaTotal` para el total.
  deltas: (number | null)[];
  deltaTotal: number | null;
}

const ENCABEZADOS = [
  'Nro.',
  'Tareas',
  '% de Fase',
  'Días Totales',
  'Días Planificados',
  'Días Reales',
  '% Planificado',
  '% Real',
  '% Cumplimiento',
  'Semáforo',
  '% Avance Planificado',
  '% Avance Real',
  'Δ vs. corte anterior',
  'Actividades',
  'Cerradas',
  'tipo',
];

// Misma paleta que los Gantt (homologada con el cronograma de referencia).
const ETAPA_FONDO = COLOR.etapaFondo;
const EPICA_FONDO = COLOR.epicaFondo;
const TAREA_FONDO = COLOR.tareaFondo;
const TOTAL_DESTACADO = COLOR.desarrollo;

export async function exportarAvanceCedulaComoExcel(opciones: ExportarAvanceCedulaOpciones): Promise<void> {
  const ExcelJS = (await import('exceljs')).default;
  const { filas, deltas } = opciones;

  const workbook = new ExcelJS.Workbook();
  const hoja = workbook.addWorksheet('Avance Célula', { views: [{ state: 'frozen', xSplit: 2, ySplit: 2 }] });

  const FILA_ENC = 2;
  const FILA_INI = 3;
  const FILA_FIN = FILA_INI + Math.max(filas.length, 1) - 1;
  const FILA_TOTAL = FILA_FIN + 1;
  const T = FILA_TOTAL;

  hoja.getColumn(1).width = 6;
  hoja.getColumn(2).width = 60;
  for (let c = 3; c <= 15; c++) hoja.getColumn(c).width = c === 10 ? 12 : 13;
  hoja.getColumn(16).hidden = true; // tipo de fila, solo para las fórmulas del total

  // Título
  hoja.mergeCells(1, 1, 1, 15);
  hoja.getCell(1, 1).value = opciones.titulo;
  hoja.getCell(1, 1).font = { bold: true, size: 13 };
  hoja.getRow(1).height = 22;

  ENCABEZADOS.forEach((t, i) => {
    const c = hoja.getCell(FILA_ENC, i + 1);
    c.value = t;
    c.fill = fillSolido(COLOR.encabezadoFondo);
    c.font = { bold: true, color: { argb: COLOR.blanco }, size: 9 };
    c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    c.border = bordeFino();
  });
  hoja.getRow(FILA_ENC).height = 32;

  // Fórmulas de una fila (las mismas para etapas, hijos y el total).
  const formulasFila = (r: number) => {
    const cerrada = `AND($N${r}>0,$O${r}=$N${r})`;
    const tope = (expr: string) => `IF(${cerrada},${expr},MIN(${expr},1))`;
    const ratio = `$F${r}/$E${r}`;
    return {
      3: `IF($D$${T}=0,"—",$D${r}/$D$${T})`,
      7: `IF($D${r}=0,"—",$E${r}/$D${r})`,
      8: `IF($D${r}=0,"—",${tope(`$F${r}/$D${r}`)})`,
      9: `IF($E${r}=0,"—",${tope(ratio)})`,
      10:
        `IF($E${r}=0,"Sin iniciar",IF(${cerrada},` +
        `IF(ABS(${ratio}-1)<=0.05,"Verde",IF(ABS(${ratio}-1)<=0.08,"Amarillo","Rojo")),` +
        `IF(${ratio}>1,"Rojo",IF(${ratio}>=0.8,"Amarillo","Verde"))))`,
      11: `IF($D$${T}=0,"—",$E${r}/$D$${T})`,
      12: `IF($D$${T}=0,"—",${tope(`$F${r}/$D$${T}`)})`,
    } as Record<number, string>;
  };

  const aplicarFormulas = (r: number) => {
    for (const [col, formula] of Object.entries(formulasFila(r))) {
      const c = hoja.getCell(r, Number(col));
      c.value = { formula };
      if (Number(col) !== 10) c.numFmt = '0.0%';
    }
  };

  // Para que la fila de cada etapa sume solo a sus hijos: hasta la
  // próxima etapa (las filas vienen agrupadas así desde el reporte).
  const finDeEtapa = (i: number) => {
    let j = i + 1;
    while (j < filas.length && !filas[j].esEncabezadoEtapa) j++;
    return j - 1;
  };

  filas.forEach((f, i) => {
    const r = FILA_INI + i;
    const fondo = f.esEncabezadoEtapa ? ETAPA_FONDO : f.tipo === 'epica' ? EPICA_FONDO : TAREA_FONDO;
    const colorTexto = f.esEncabezadoEtapa ? COLOR.etapaTexto : COLOR.actividadTexto;

    hoja.getCell(r, 1).value = i + 1;
    hoja.getCell(r, 2).value = f.nombre;
    hoja.getCell(r, 16).value = f.tipo;

    if (f.esEncabezadoEtapa) {
      const fin = finDeEtapa(i);
      for (const col of [4, 5, 6, 14, 15]) {
        const L = hoja.getColumn(col).letter;
        hoja.getCell(r, col).value = fin > i ? { formula: `SUM(${L}${r + 1}:${L}${FILA_INI + fin})` } : 0;
      }
    } else {
      hoja.getCell(r, 4).value = f.diasTotales;
      hoja.getCell(r, 5).value = f.diasPlanificados;
      hoja.getCell(r, 6).value = f.diasReales;
      hoja.getCell(r, 14).value = f.totalActividades;
      hoja.getCell(r, 15).value = f.actividadesCerradas;
    }
    aplicarFormulas(r);

    const delta = deltas[i];
    if (delta != null) {
      hoja.getCell(r, 13).value = delta / 100;
      hoja.getCell(r, 13).numFmt = '+0.0%;-0.0%;0.0%';
    } else {
      hoja.getCell(r, 13).value = '—';
    }

    for (let col = 1; col <= 15; col++) {
      const c = hoja.getCell(r, col);
      c.fill = fillSolido(col === 13 ? COLOR.blanco : fondo);
      c.font = { size: 9, bold: f.esEncabezadoEtapa, color: { argb: col === 13 ? 'FF1F2937' : colorTexto } };
      c.alignment = { horizontal: col === 2 ? 'left' : 'center', vertical: 'middle', indent: col === 2 && !f.esEncabezadoEtapa ? 1 : 0 };
      c.border = bordeFino();
    }
  });

  // Total del proyecto: suma de los hijos (no de las etapas, para no
  // contar dos veces) — igual que calcularFilasConPorcentajes.
  hoja.mergeCells(T, 1, T, 2);
  hoja.getCell(T, 1).value = opciones.totalNombre;
  hoja.getCell(T, 16).value = 'total';
  for (const col of [4, 5, 6, 14, 15]) {
    const L = hoja.getColumn(col).letter;
    hoja.getCell(T, col).value = {
      formula: `SUMIF($P$${FILA_INI}:$P$${FILA_FIN},"<>etapa",${L}${FILA_INI}:${L}${FILA_FIN})`,
    };
  }
  aplicarFormulas(T);
  if (opciones.deltaTotal != null) {
    hoja.getCell(T, 13).value = opciones.deltaTotal / 100;
    hoja.getCell(T, 13).numFmt = '+0.0%;-0.0%;0.0%';
  } else {
    hoja.getCell(T, 13).value = '—';
  }
  for (let col = 1; col <= 15; col++) {
    const c = hoja.getCell(T, col);
    const destacado = col === 9 || col === 11 || col === 12;
    c.fill = fillSolido(col === 13 ? COLOR.blanco : destacado ? TOTAL_DESTACADO : COLOR.encabezadoFondo);
    c.font = { bold: true, size: 10, color: { argb: col === 13 ? 'FF1F2937' : COLOR.blanco } };
    c.alignment = { horizontal: col <= 2 ? 'left' : 'center', vertical: 'middle' };
    c.border = bordeFino();
  }
  hoja.getRow(T).height = 22;

  // --- Reglas de coloración, como en el front ---
  hoja.addConditionalFormatting({
    ref: `J${FILA_INI}:J${FILA_TOTAL}`,
    rules: [
      { type: 'cellIs', operator: 'equal', formulae: ['"Verde"'], priority: 1, style: estiloCondicional(COLOR.semaforoVerde, COLOR.blanco, true) },
      { type: 'cellIs', operator: 'equal', formulae: ['"Amarillo"'], priority: 2, style: estiloCondicional(COLOR.semaforoAmarillo, COLOR.blanco, true) },
      { type: 'cellIs', operator: 'equal', formulae: ['"Rojo"'], priority: 3, style: estiloCondicional(COLOR.semaforoRojo, COLOR.blanco, true) },
      { type: 'cellIs', operator: 'equal', formulae: ['"Sin iniciar"'], priority: 4, style: estiloCondicional(COLOR.semaforoNegro, COLOR.blanco, true) },
    ],
  });
  hoja.addConditionalFormatting({
    ref: `M${FILA_INI}:M${FILA_TOTAL}`,
    rules: [
      { type: 'expression', formulae: [`AND(ISNUMBER(M${FILA_INI}),M${FILA_INI}>0)`], priority: 5, style: estiloCondicional(COLOR.blanco, 'FF15803D', true) },
      { type: 'expression', formulae: [`AND(ISNUMBER(M${FILA_INI}),M${FILA_INI}<0)`], priority: 6, style: estiloCondicional(COLOR.blanco, 'FFDC2626', true) },
    ],
  });

  // Leyenda del semáforo (igual que el panel lateral de la página).
  const leyenda = [
    'Semáforo — si queda algo abierto: Verde < 80% de los días planificados · Amarillo 80%–100% · Rojo ya superó lo planificado sin cerrar.',
    'Si todo está cerrado: Verde desviación ≤ 5% · Amarillo > 5% y ≤ 8% · Rojo > 8%. Sin iniciar = todavía no tiene días planificados.',
    'Desviación = |Días Reales / Días Planificados − 100%|. Los % y el semáforo se recalculan si se editan los días.',
  ];
  leyenda.forEach((texto, k) => {
    const r = FILA_TOTAL + 2 + k;
    hoja.mergeCells(r, 1, r, 15);
    hoja.getCell(r, 1).value = texto;
    hoja.getCell(r, 1).font = { size: 9, italic: true, color: { argb: 'FF475569' } };
  });

  await descargarWorkbook(workbook, opciones.nombreArchivo);
}
