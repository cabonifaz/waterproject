// lib/services/importExcelService.ts
// Carga masiva de épicas + HU dentro de un módulo, desde un Excel — para
// no tener que crear cada épica/HU a mano una por una. Formato esperado
// (ver generarPlantillaExcel): una fila por HU, con la columna "Épica"
// repetida en las filas que pertenecen a la misma épica; si ya existe una
// épica con ese nombre en el módulo, se reusa (no se duplica).

import ExcelJS from 'exceljs';
import * as epicasService from './epicasService';
import * as historiasUsuarioService from './historiasUsuarioService';
import { HistoriaUsuario, Epica } from '@/types';

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
  epicasReactivadas: number;
  huCreadas: number;
  huReactivadas: number;
  huOmitidas: number;
  errores: string[];
}

export async function importarEpicasHU(moduloId: number, archivo: Buffer): Promise<ResultadoImportacion> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(archivo as unknown as ExcelJS.Buffer);
  const hoja = workbook.worksheets[0];
  if (!hoja) {
    return {
      epicasCreadas: 0,
      epicasReusadas: 0,
      epicasReactivadas: 0,
      huCreadas: 0,
      huReactivadas: 0,
      huOmitidas: 0,
      errores: ['El Excel no tiene ninguna hoja'],
    };
  }

  // Incluye épicas eliminadas: la unique key (modulo_id, nombre) reserva
  // el nombre igual, así que hay que matchear también contra ellas y
  // reactivar en vez de intentar crear una duplicada.
  const epicasExistentes = await epicasService.listarEpicasModuloTodas(moduloId);
  const epicaPorNombre = new Map<string, Epica>(epicasExistentes.map((e) => [e.nombre.trim().toLowerCase(), e]));
  let siguienteOrdenEpica = epicasExistentes.length;
  const ordenHUPorEpica = new Map<number, number>();
  const epicasReusadasContadas = new Set<number>();

  // HU existentes (activas e inactivas) de cada épica ya tocada en este
  // import, indexadas por código en minúsculas — para no duplicar una HU
  // si el Excel trae de nuevo su código (y reactivarla si estaba eliminada).
  const huPorCodigoPorEpica = new Map<number, Map<string, HistoriaUsuario>>();
  const obtenerHUPorCodigo = async (epicaId: number): Promise<Map<string, HistoriaUsuario>> => {
    let mapa = huPorCodigoPorEpica.get(epicaId);
    if (!mapa) {
      const historias = await historiasUsuarioService.listarHUEpicaTodas(epicaId);
      mapa = new Map(
        historias.filter((h) => h.codigo && h.codigo.trim()).map((h) => [h.codigo!.trim().toLowerCase(), h])
      );
      huPorCodigoPorEpica.set(epicaId, mapa);
    }
    return mapa;
  };

  const resultado: ResultadoImportacion = {
    epicasCreadas: 0,
    epicasReusadas: 0,
    epicasReactivadas: 0,
    huCreadas: 0,
    huReactivadas: 0,
    huOmitidas: 0,
    errores: [],
  };

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
      let epicaExistente = epicaPorNombre.get(clave);
      let epicaId: number;
      if (!epicaExistente) {
        siguienteOrdenEpica += 1;
        epicaId = await epicasService.crearEpica({ modulo_id: moduloId, nombre: nombreEpica, orden: siguienteOrdenEpica });
        epicaPorNombre.set(clave, { id: epicaId, modulo_id: moduloId, nombre: nombreEpica, activa: true, orden: siguienteOrdenEpica } as Epica);
        resultado.epicasCreadas += 1;
      } else {
        epicaId = epicaExistente.id;
        if (!epicaExistente.activa) {
          // Estaba eliminada (soft-delete): re-subir el Excel la recupera
          // en vez de crear una épica nueva (que además chocaría con la
          // unique key modulo_id+nombre).
          await epicasService.reactivarEpica(epicaId);
          epicaExistente.activa = true;
          resultado.epicasReactivadas += 1;
        } else if (!epicasReusadasContadas.has(epicaId)) {
          epicasReusadasContadas.add(epicaId);
          resultado.epicasReusadas += 1;
        }
      }

      const huExistente = codigo ? (await obtenerHUPorCodigo(epicaId)).get(codigo.toLowerCase()) : undefined;

      if (huExistente) {
        if (huExistente.activa) {
          // Ya existe una HU activa con este código en la épica: no se
          // duplica ni se sobreescribe.
          resultado.huOmitidas += 1;
        } else {
          // Estaba eliminada (soft-delete): re-subir el Excel la recupera
          // en vez de crear una HU nueva con el mismo código.
          await historiasUsuarioService.reactivarHistoriaUsuario(huExistente.id);
          huExistente.activa = true; // si el Excel repite el código en otra fila, que la trate como activa
          resultado.huReactivadas += 1;
        }
      } else {
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
      }
    } catch (err) {
      resultado.errores.push(
        `Fila ${numeroFilaExcel} (${nombreEpica} — ${titulo}): ${err instanceof Error ? err.message : 'error desconocido'}`
      );
    }
  }

  return resultado;
}
