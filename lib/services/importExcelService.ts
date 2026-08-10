// lib/services/importExcelService.ts
// Carga masiva de épicas + HU dentro de un módulo, desde un Excel — para
// no tener que crear cada épica/HU a mano una por una. Formato esperado
// (ver generarPlantillaExcel): una fila por HU, con la columna "Épica"
// repetida en las filas que pertenecen a la misma épica; si ya existe una
// épica con ese nombre en el módulo, se reusa (no se duplica).

import ExcelJS from 'exceljs';
import * as epicasService from './epicasService';
import * as historiasUsuarioService from './historiasUsuarioService';

const COLUMNAS = ['Épica / Funcionalidad', 'Código', 'Título', 'Descripción', 'Prioridad'] as const;

export async function generarPlantillaExcel(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const hoja = workbook.addWorksheet('Épicas y HU');

  hoja.columns = [
    { header: COLUMNAS[0], key: 'epica', width: 40 },
    { header: COLUMNAS[1], key: 'codigo', width: 14 },
    { header: COLUMNAS[2], key: 'titulo', width: 50 },
    { header: COLUMNAS[3], key: 'descripcion', width: 50 },
    { header: COLUMNAS[4], key: 'prioridad', width: 12 },
  ];
  hoja.getRow(1).font = { bold: true };

  hoja.addRow({
    epica: 'Buscar pago de servicio por categoría',
    codigo: 'PS02-CF109',
    titulo: 'Búsqueda de empresa',
    descripcion: 'Como usuario quiero buscar una empresa por categoría',
    prioridad: 'media',
  });
  hoja.addRow({
    epica: 'Buscar pago de servicio por categoría',
    codigo: 'PS02-CF110',
    titulo: 'Filtrar resultados de búsqueda',
    descripcion: '',
    prioridad: 'baja',
  });
  hoja.addRow({
    epica: 'Visualizar pago de servicios',
    codigo: 'PS01-CF81',
    titulo: 'Visualizar historial de pagos de servicios',
    descripcion: '',
    prioridad: 'alta',
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export interface ResultadoImportacion {
  epicasCreadas: number;
  epicasReusadas: number;
  huCreadas: number;
  errores: string[];
}

export async function importarEpicasHU(moduloId: number, archivo: Buffer): Promise<ResultadoImportacion> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(archivo as unknown as ExcelJS.Buffer);
  const hoja = workbook.worksheets[0];
  if (!hoja) {
    return { epicasCreadas: 0, epicasReusadas: 0, huCreadas: 0, errores: ['El Excel no tiene ninguna hoja'] };
  }

  const epicasExistentes = await epicasService.listarEpicasModulo(moduloId);
  const epicaIdPorNombre = new Map<string, number>(epicasExistentes.map((e) => [e.nombre.trim().toLowerCase(), e.id]));
  let siguienteOrdenEpica = epicasExistentes.length;
  const ordenHUPorEpica = new Map<number, number>();

  const resultado: ResultadoImportacion = { epicasCreadas: 0, epicasReusadas: 0, huCreadas: 0, errores: [] };

  const filas = hoja.getRows(2, Math.max(hoja.rowCount - 1, 0)) || [];

  for (let i = 0; i < filas.length; i++) {
    const fila = filas[i];
    const numeroFilaExcel = i + 2;

    const nombreEpica = String(fila.getCell(1).value ?? '').trim();
    const codigo = String(fila.getCell(2).value ?? '').trim();
    const titulo = String(fila.getCell(3).value ?? '').trim();
    const descripcion = String(fila.getCell(4).value ?? '').trim();
    const prioridadCruda = String(fila.getCell(5).value ?? '').trim().toLowerCase();

    if (!nombreEpica && !titulo) continue; // fila vacía, se ignora sin error

    if (!nombreEpica || !titulo) {
      resultado.errores.push(`Fila ${numeroFilaExcel}: faltan datos (Épica / Funcionalidad y Título son obligatorios).`);
      continue;
    }

    const prioridad = (['baja', 'media', 'alta'] as const).includes(prioridadCruda as 'baja' | 'media' | 'alta')
      ? prioridadCruda
      : 'media';

    try {
      const clave = nombreEpica.toLowerCase();
      let epicaId = epicaIdPorNombre.get(clave);
      if (!epicaId) {
        siguienteOrdenEpica += 1;
        epicaId = await epicasService.crearEpica({ modulo_id: moduloId, nombre: nombreEpica, orden: siguienteOrdenEpica });
        epicaIdPorNombre.set(clave, epicaId);
        resultado.epicasCreadas += 1;
      } else if (!ordenHUPorEpica.has(epicaId)) {
        resultado.epicasReusadas += 1;
      }

      const orden = (ordenHUPorEpica.get(epicaId) ?? 0) + 1;
      ordenHUPorEpica.set(epicaId, orden);

      await historiasUsuarioService.crearHistoriaUsuario({
        epica_id: epicaId,
        codigo: codigo || undefined,
        titulo,
        descripcion: descripcion || undefined,
        prioridad,
        orden,
      });
      resultado.huCreadas += 1;
    } catch (err) {
      resultado.errores.push(
        `Fila ${numeroFilaExcel} (${nombreEpica} — ${titulo}): ${err instanceof Error ? err.message : 'error desconocido'}`
      );
    }
  }

  return resultado;
}
