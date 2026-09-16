// app/api/observaciones/[id]/levantada/route.ts
// Marca/desmarca si una observación ya se levantó (resolvió) — un flag
// simple, independiente del flujo de 5 estados de certificación.

import { NextRequest, NextResponse } from 'next/server';
import * as observacionesService from '@/lib/services/observacionesService';

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = parseInt(params.id, 10);
    const body = await request.json();
    const { levantada } = body;

    if (typeof levantada !== 'boolean') {
      return NextResponse.json({ error: 'Campo requerido: levantada (boolean)' }, { status: 400 });
    }

    const observacion = await observacionesService.marcarObservacionLevantada(id, levantada);

    return NextResponse.json({ success: true, data: observacion, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('Error marcando la observación como levantada:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al actualizar la observación' },
      { status: 500 }
    );
  }
}
