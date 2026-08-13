// app/api/historias-usuario/[id]/dias-restantes/route.ts
// Actualiza la reestimación de "días restantes" de una HU (para proyectar
// el atraso mientras sigue abierta). body.dias = null borra la estimación.

import { NextRequest, NextResponse } from 'next/server';
import * as historiasUsuarioService from '@/lib/services/historiasUsuarioService';

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = parseInt(params.id, 10);
    const body = await request.json();
    const dias = body.dias === null ? null : Number(body.dias);
    if (dias !== null && (!Number.isFinite(dias) || dias < 0)) {
      return NextResponse.json({ error: 'dias debe ser un número mayor o igual a 0, o null' }, { status: 400 });
    }

    const hu = await historiasUsuarioService.actualizarDiasRestantes(id, dias);

    return NextResponse.json({ success: true, data: hu, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('Error actualizando días restantes de la HU:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al actualizar días restantes' },
      { status: 500 }
    );
  }
}
