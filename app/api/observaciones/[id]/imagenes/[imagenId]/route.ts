// app/api/observaciones/[id]/imagenes/[imagenId]/route.ts
// Sirve los bytes crudos de una imagen (usable directo como src de <img>)
// y permite borrarla.

import { NextRequest, NextResponse } from 'next/server';
import * as observacionesImagenesService from '@/lib/services/observacionesImagenesService';

export async function GET(request: NextRequest, { params }: { params: { imagenId: string } }) {
  try {
    const imagenId = parseInt(params.imagenId, 10);
    const imagen = await observacionesImagenesService.obtenerImagen(imagenId);
    if (!imagen) {
      return NextResponse.json({ error: 'Imagen no encontrada' }, { status: 404 });
    }

    return new NextResponse(new Uint8Array(imagen.contenido), {
      headers: {
        'Content-Type': imagen.tipo_mime,
        'Cache-Control': 'private, max-age=86400',
      },
    });
  } catch (error) {
    console.error('Error obteniendo imagen:', error);
    return NextResponse.json({ error: 'Error al obtener la imagen' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { imagenId: string } }) {
  try {
    const imagenId = parseInt(params.imagenId, 10);
    await observacionesImagenesService.eliminarImagen(imagenId);

    return NextResponse.json({ success: true, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('Error eliminando imagen:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al eliminar la imagen' },
      { status: 500 }
    );
  }
}
