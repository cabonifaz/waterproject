// app/api/sprints/[id]/route.ts
// Edita las fechas de un sprint. body.desplazar = true corre también los
// sprints siguientes del PI (ampliar el planificado sin superponer).

import { NextRequest, NextResponse } from 'next/server';
import * as sprintsService from '@/lib/services/sprintsService';

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = parseInt(params.id, 10);
    if (!id) return NextResponse.json({ error: 'id inválido' }, { status: 400 });
    const body = await request.json();
    if (!FECHA.test(body.fecha_inicio ?? '') || !FECHA.test(body.fecha_fin ?? '')) {
      return NextResponse.json({ error: 'Campos requeridos: fecha_inicio, fecha_fin (yyyy-mm-dd)' }, { status: 400 });
    }

    const sprints = await sprintsService.actualizarSprint(id, {
      fecha_inicio: body.fecha_inicio,
      fecha_fin: body.fecha_fin,
      desplazar: !!body.desplazar,
    });

    return NextResponse.json({ success: true, data: sprints, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('Error actualizando sprint:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al actualizar el sprint' },
      { status: 500 }
    );
  }
}
