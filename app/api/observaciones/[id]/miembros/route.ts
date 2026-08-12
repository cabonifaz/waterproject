// app/api/observaciones/[id]/miembros/route.ts
// Asigna/desasigna (toggle) un miembro del proyecto a una observación.

import { NextRequest, NextResponse } from 'next/server';
import * as observacionesService from '@/lib/services/observacionesService';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const observacionId = parseInt(params.id, 10);
    const body = await request.json();
    const { miembro_id } = body;
    if (!miembro_id) {
      return NextResponse.json({ error: 'Campo requerido: miembro_id' }, { status: 400 });
    }

    await observacionesService.asignarMiembroObservacion(observacionId, miembro_id);

    return NextResponse.json({ success: true, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('Error asignando miembro a la observación:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al asignar miembro' },
      { status: 500 }
    );
  }
}
