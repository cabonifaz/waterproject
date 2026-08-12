// lib/services/observacionesImagenesService.ts
// Imágenes adjuntas a una observación, guardadas como BLOB en la propia
// base de datos (sin depender de disco persistente ni de un servicio
// externo de storage).

import { executeProcedure } from '../db';
import { ImagenObservacionMeta } from '@/types';

export async function agregarImagen(
  observacionId: number,
  nombreArchivo: string,
  tipoMime: string,
  contenido: Buffer
): Promise<number> {
  const resultado = await executeProcedure<{ id: number }>('sp_agregar_imagen_observacion', [
    observacionId,
    nombreArchivo,
    tipoMime,
    contenido,
  ]);
  return resultado[0].id;
}

export async function listarImagenes(observacionId: number): Promise<ImagenObservacionMeta[]> {
  return executeProcedure<ImagenObservacionMeta>('sp_listar_imagenes_observacion', [observacionId]);
}

export async function obtenerImagen(
  imagenId: number
): Promise<{ id: number; tipo_mime: string; nombre_archivo: string; contenido: Buffer } | null> {
  const resultado = await executeProcedure<{ id: number; tipo_mime: string; nombre_archivo: string; contenido: Buffer }>(
    'sp_obtener_imagen_observacion',
    [imagenId]
  );
  return resultado[0] || null;
}

export async function eliminarImagen(imagenId: number): Promise<void> {
  await executeProcedure('sp_eliminar_imagen_observacion', [imagenId]);
}
