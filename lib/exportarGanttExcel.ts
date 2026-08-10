// lib/exportarGanttExcel.ts
// Exporta el Gantt (Planificado o Real) completo a un .xlsx editable —
// todos los sprints y todas las filas, no solo lo que entra en pantalla,
// con los mismos colores que se ven en la app. Corre en el navegador
// (exceljs también funciona del lado del cliente).

'use client';

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

const COLOR = {
  etapaFondo: 'FF172554',
  etapaTexto: 'FFFFFFFF',
  moduloFondo: 'FFC7D2FE',
  moduloTexto: 'FF312E81',
  epicaFondo: 'FFDBEAFE',
  epicaTexto: 'FF1E3A8A',
  grupoFondo: 'FFDCFCE7',
  grupoTexto: 'FF14532D',
  diaFondo: 'FFF8FAFC',
  diaTexto: 'FF334155',
  feriadoFondo: 'FFFED7AA',
  feriadoTexto: 'FF9A3412',
  hoyFondo: 'FF9333EA',
  hoyTexto: 'FFFFFFFF',
  desarrollo: 'FF22C55E',
  certificacion: 'FFFB923C',
  cierre: 'FF2563EB',
  celdaFeriado: 'FFFFEDD5',
  blanco: 'FFFFFFFF',
  borde: 'FF94A3B8',
} as const;

const MARCA_COLOR: Record<string, string> = {
  desarrollo: COLOR.desarrollo,
  trabajo: COLOR.desarrollo,
  certificacion: COLOR.certificacion,
  cierre: COLOR.cierre,
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

function fillSolido(argb: string) {
  return { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb } };
}

function bordeFino(argb: string = COLOR.borde) {
  const estilo = { style: 'thin' as const, color: { argb } };
  return { top: estilo, left: estilo, bottom: estilo, right: estilo };
}

const GROSOR_MES: import('exceljs').BorderStyle = 'thick';
const GROSOR_SPRINT: import('exceljs').BorderStyle = 'medium';
const COLOR_BORDE_MES = 'FF0F172A'; // slate-900, el separador más marcado
const COLOR_BORDE_SPRINT = 'FF334155'; // slate-700

// Borde de una celda-día: el lado izquierdo marca el inicio de mes (más
// grueso) o de sprint (grueso) — igual que el border-l-4 / border-l-2 en
// pantalla — y los otros tres lados quedan finos, o con el color/ancho de
// la marca planificada de referencia (solo Gantt Real) si aplica.
function bordeColumnaDia(esInicioMes: boolean, esInicioGrupo: boolean, colorReferencia?: string) {
  const ladoReferencia = colorReferencia
    ? { style: 'medium' as const, color: { argb: colorReferencia } }
    : { style: 'thin' as const, color: { argb: COLOR.borde } };

  const ladoIzquierdo = esInicioMes
    ? { style: GROSOR_MES, color: { argb: COLOR_BORDE_MES } }
    : esInicioGrupo
    ? { style: GROSOR_SPRINT, color: { argb: COLOR_BORDE_SPRINT } }
    : ladoReferencia;

  return { top: ladoReferencia, right: ladoReferencia, bottom: ladoReferencia, left: ladoIzquierdo };
}

export async function exportarGanttComoExcel(opciones: ExportarGanttOpciones): Promise<void> {
  const ExcelJS = (await import('exceljs')).default;
  const { columnas, items, marcas, marcasPlanificadas, nombreArchivo, nombreHoja } = opciones;

  const workbook = new ExcelJS.Workbook();
  const hoja = workbook.addWorksheet(nombreHoja, {
    views: [{ state: 'frozen', xSplit: 3, ySplit: 3 }],
  });

  const COL_INICIO_DIAS = 4; // A=Actividad, B=H, C=Miembros, D...=días

  // Primer día de cada mes/sprint — misma lógica que "esInicioGrupo" en
  // las páginas de Gantt, calculada acá para no depender de que el
  // llamador la mande.
  const inicioMes = columnas.map((c, i) => i === 0 || c.mesLabel !== columnas[i - 1].mesLabel);

  // Aplica el borde de columna (grosor de mes/sprint a la izquierda) a
  // una fila completa de días — se reusa para las 3 filas de encabezado
  // y para cada fila de actividad, así el separador queda como una línea
  // continua de arriba a abajo.
  const aplicarBordesDia = (filaExcel: number, colorReferencia?: (i: number) => string | undefined) => {
    columnas.forEach((c, i) => {
      hoja.getCell(filaExcel, COL_INICIO_DIAS + i).border = bordeColumnaDia(
        inicioMes[i],
        c.esInicioGrupo,
        colorReferencia?.(i)
      );
    });
  };

  hoja.getColumn(1).width = 42;
  hoja.getColumn(2).width = 5;
  hoja.getColumn(3).width = 16;
  for (let i = 0; i < columnas.length; i++) hoja.getColumn(COL_INICIO_DIAS + i).width = 5;

  // --- Encabezados (3 filas: meses, sprints, días) ---
  hoja.mergeCells(1, 1, 3, 1);
  hoja.mergeCells(1, 2, 3, 2);
  hoja.mergeCells(1, 3, 3, 3);
  const corner = [hoja.getCell(1, 1), hoja.getCell(1, 2), hoja.getCell(1, 3)];
  corner[0].value = 'Actividad';
  corner[1].value = 'H';
  corner[2].value = 'Miembros';
  for (const c of corner) {
    c.fill = fillSolido(COLOR.diaFondo);
    c.font = { bold: true };
    c.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    c.border = bordeFino();
  }

  const gruposMes = agruparConsecutivos(columnas, (c) => c.mesLabel);
  let colCursor = COL_INICIO_DIAS;
  for (const g of gruposMes) {
    hoja.mergeCells(1, colCursor, 1, colCursor + g.cantidad - 1);
    const cell = hoja.getCell(1, colCursor);
    cell.value = g.label;
    cell.fill = fillSolido(COLOR.grupoFondo);
    cell.font = { bold: true, color: { argb: COLOR.grupoTexto } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    colCursor += g.cantidad;
  }
  aplicarBordesDia(1);

  const gruposSprint = agruparConsecutivos(columnas, (c) => c.grupoLabel);
  colCursor = COL_INICIO_DIAS;
  for (const g of gruposSprint) {
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
    // mismo archivo sin depender de parsear el texto visible de la celda
    // (que solo trae día de semana + día del mes, sin año/mes).
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
      hoja.mergeCells(fila, 1, fila, 3);
      const label = hoja.getCell(fila, 1);
      label.value = item.label;
      label.fill = fillSolido(estilo.fondo);
      label.font = { bold: true, color: { argb: estilo.texto }, size: 10 };
      label.alignment = { vertical: 'middle', indent: item.nivel === 'epica' ? 2 : item.nivel === 'modulo' ? 1 : 0 };
      label.border = bordeFino();

      if (columnas.length > 0) {
        hoja.mergeCells(fila, COL_INICIO_DIAS, fila, COL_INICIO_DIAS + columnas.length - 1);
        const barra = hoja.getCell(fila, COL_INICIO_DIAS);
        barra.fill = fillSolido(estilo.fondo);
        barra.border = bordeFino();
      }

      hoja.getRow(fila).height = 16;
      fila++;
      continue;
    }

    const f = item;
    hoja.getCell(fila, 1).value = f.etiqueta;
    hoja.getCell(fila, 1).alignment = { indent: 2 };
    hoja.getCell(fila, 1).font = { size: 9 };
    // Nota oculta con la identidad real de la fila (tipo:id) — permite
    // reimportar este archivo identificando cada fila aunque se reordenen
    // o edite el texto de la etiqueta.
    hoja.getCell(fila, 1).note = `${f.tipo}:${f.id}`;

    if (f.fechaCierre) {
      const celdaH = hoja.getCell(fila, 2);
      celdaH.value = 'H';
      celdaH.fill = fillSolido(COLOR.cierre);
      celdaH.font = { bold: true, color: { argb: COLOR.blanco }, size: 9 };
      celdaH.alignment = { horizontal: 'center', vertical: 'middle' };
      celdaH.note = `Fecha de cierre: ${f.fechaCierre}`;
    }

    hoja.getCell(fila, 3).value = f.miembros;
    hoja.getCell(fila, 3).font = { size: 8 };
    hoja.getCell(fila, 3).alignment = { horizontal: 'center' };

    for (let c1 = 1; c1 <= 3; c1++) hoja.getCell(fila, c1).border = bordeFino();

    columnas.forEach((c, i) => {
      const col = COL_INICIO_DIAS + i;
      const cell = hoja.getCell(fila, col);
      const marca = marcas.get(claveMarca(f.tipo, f.id, c.fecha));
      const marcaPlan = marcasPlanificadas?.get(claveMarca(f.tipo, f.id, c.fecha));

      const fondo = marca ? MARCA_COLOR[marca] : c.esFeriado ? COLOR.celdaFeriado : c.esHoy ? 'FFF3E8FF' : COLOR.blanco;
      cell.fill = fillSolido(fondo);
      if (marca === 'cierre') {
        cell.value = 'H';
        cell.font = { bold: true, color: { argb: COLOR.blanco }, size: 8 };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      } else if (marca === 'desarrollo' || marca === 'trabajo') {
        // Texto "DE" oculto (mismo color que el fondo verde) para permitir
        // conteos con COUNTIF/COUNTIFS en Excel sin que se vea la letra.
        cell.value = 'DE';
        cell.font = { color: { argb: COLOR.desarrollo }, size: 8 };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      } else if (marca === 'certificacion') {
        // Texto "HU" oculto (mismo color que el fondo naranja), misma idea.
        cell.value = 'HU';
        cell.font = { color: { argb: COLOR.certificacion }, size: 8 };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      }
      if (marcaPlan) cell.note = `Planificado: ${marcaPlan}`;
    });

    aplicarBordesDia(fila, (i) => {
      const marcaPlan = marcasPlanificadas?.get(claveMarca(f.tipo, f.id, columnas[i].fecha));
      return marcaPlan ? MARCA_COLOR[marcaPlan] : undefined;
    });

    fila++;
  }

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
