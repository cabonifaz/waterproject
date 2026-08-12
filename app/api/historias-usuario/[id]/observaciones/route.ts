// app/api/historias-usuario/[id]/observaciones/route.ts
// Lista las observaciones de una HU (con iteraciones y cantidad de
// imágenes ya calculadas) — alimenta el botón/modal del Gantt Real.

import { NextRequest, NextResponse } from 'next/server';
import * as observacionesService from '@/lib/services/observacionesService';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const historiaUsuarioId = parseInt(params.id, 10);
    const observaciones = await observacionesService.listarObservacionesHU(historiaUsuarioId);

    return NextResponse.json({ success: true, data: observaciones, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('Error listando observaciones de la HU:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al listar observaciones' },
      { status: 500 }
    );
  }
}
