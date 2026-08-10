// app/api/historias-usuario/[id]/miembros/route.ts
// Asigna/desasigna (toggle) un miembro del proyecto a una HU.

import { NextRequest, NextResponse } from 'next/server';
import * as miembrosService from '@/lib/services/miembrosService';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const historiaUsuarioId = parseInt(params.id, 10);
    const body = await request.json();
    const { miembro_id } = body;
    if (!miembro_id) {
      return NextResponse.json({ error: 'Campo requerido: miembro_id' }, { status: 400 });
    }

    await miembrosService.asignarMiembroHU(historiaUsuarioId, miembro_id);

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error asignando miembro a HU:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al asignar miembro' },
      { status: 500 }
    );
  }
}
