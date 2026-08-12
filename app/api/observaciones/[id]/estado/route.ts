// app/api/observaciones/[id]/estado/route.ts
// Cambia el estado de una observación — cada cambio queda registrado en
// el historial (es la fuente de "cuántas iteraciones" tuvo la observación).

import { NextRequest, NextResponse } from 'next/server';
import * as observacionesService from '@/lib/services/observacionesService';
import { EstadoObservacion } from '@/types';

const ESTADOS_VALIDOS: EstadoObservacion[] = ['en_atencion', 'en_analisis', 'en_publicacion', 're_test', 'certificada'];

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = parseInt(params.id, 10);
    const body = await request.json();
    const { estado, nota } = body;

    if (!ESTADOS_VALIDOS.includes(estado)) {
      return NextResponse.json({ error: `Estado inválido. Debe ser uno de: ${ESTADOS_VALIDOS.join(', ')}` }, { status: 400 });
    }

    const observacion = await observacionesService.cambiarEstadoObservacion(id, estado, nota);

    return NextResponse.json({ success: true, data: observacion, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('Error cambiando estado de la observación:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al cambiar el estado' },
      { status: 500 }
    );
  }
}
