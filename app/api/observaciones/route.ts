// app/api/observaciones/route.ts

import { NextRequest, NextResponse } from 'next/server';
import * as observacionesService from '@/lib/services/observacionesService';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body.historia_usuario_id || !body.titulo) {
      return NextResponse.json({ error: 'Campos requeridos: historia_usuario_id, titulo' }, { status: 400 });
    }

    const observacion = await observacionesService.crearObservacion({
      historia_usuario_id: body.historia_usuario_id,
      titulo: body.titulo,
      descripcion: body.descripcion,
    });

    return NextResponse.json(
      { success: true, data: observacion, timestamp: new Date().toISOString() },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creando observación:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al crear la observación' },
      { status: 500 }
    );
  }
}
