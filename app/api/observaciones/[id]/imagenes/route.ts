// app/api/observaciones/[id]/imagenes/route.ts
// Sube una imagen adjunta a una observación (multipart/form-data, campo
// "archivo") — se guarda como BLOB en la base de datos.

import { NextRequest, NextResponse } from 'next/server';
import * as observacionesImagenesService from '@/lib/services/observacionesImagenesService';

const TAMANIO_MAXIMO = 8 * 1024 * 1024; // 8 MB por imagen

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const observacionId = parseInt(params.id, 10);
    const formData = await request.formData();
    const archivo = formData.get('archivo');
    if (!(archivo instanceof Blob)) {
      return NextResponse.json({ error: 'Campo requerido: archivo (imagen)' }, { status: 400 });
    }
    if (!archivo.type.startsWith('image/')) {
      return NextResponse.json({ error: 'El archivo debe ser una imagen' }, { status: 400 });
    }
    if (archivo.size > TAMANIO_MAXIMO) {
      return NextResponse.json({ error: 'La imagen supera el tamaño máximo permitido (8 MB)' }, { status: 400 });
    }

    const buffer = Buffer.from(await archivo.arrayBuffer());
    const nombreArchivo = archivo instanceof File ? archivo.name : 'imagen';
    const id = await observacionesImagenesService.agregarImagen(observacionId, nombreArchivo, archivo.type, buffer);

    return NextResponse.json(
      { success: true, data: { id }, timestamp: new Date().toISOString() },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error subiendo imagen de la observación:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al subir la imagen' },
      { status: 500 }
    );
  }
}
