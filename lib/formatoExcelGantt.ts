// lib/formatoExcelGantt.ts
// Contrato entre el exportador (lib/exportarGanttExcel.ts, navegador) y el
// importador (lib/services/importGanttExcelService.ts, servidor) del Excel
// de Gantt: dónde van las fechas de cada columna-día y la identidad de
// cada actividad, sin usar notas de celda (que muestran un triangulito
// rojo en cada celda).

// Valor de la celda A de la fila oculta con la fecha ISO (yyyy-mm-dd) de
// cada columna-día. Ya no se exporta (la fecha va en el encabezado del día),
// pero el importador la sigue aceptando en archivos generados con ese formato.
export const MARCA_FILA_FECHAS = '__fechas';

// Valor de la fila 1 de la columna oculta (al final) que trae el
// "tipo:id" de cada actividad (ej. "hu:12", "tareaMatriz:5").
export const MARCA_COLUMNA_ID = '__id';
