// app/api/observaciones/[id]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import * as observacionesService from '@/lib/services/observacionesService';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = parseInt(params.id, 10);
    const observacion = await observacionesService.obtenerObservacionCompleta(id);
    if (!observacion) {
      return NextResponse.json({ error: 'Observación no encontrada' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: observacion, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('Error obteniendo observación:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al obtener la observación' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = parseInt(params.id, 10);
    await observacionesService.eliminarObservacion(id);

    return NextResponse.json({ success: true, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('Error eliminando observación:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al eliminar la observación' },
      { status: 500 }
    );
  }
}
