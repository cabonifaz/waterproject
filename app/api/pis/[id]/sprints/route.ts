// app/api/pis/[id]/sprints/route.ts
// Sprints de un PI. GET lista, POST genera en lote (fecha inicio +
// duración + cantidad) — si el PI ya tiene sprints, sigue numerando.

import { NextRequest, NextResponse } from 'next/server';
import * as sprintsService from '@/lib/services/sprintsService';

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const piId = parseInt(params.id, 10);
    if (!piId) return NextResponse.json({ error: 'id inválido' }, { status: 400 });
    const sprints = await sprintsService.listarSprintsPI(piId);
    return NextResponse.json({ success: true, data: sprints, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('Error listando sprints:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al listar sprints' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const piId = parseInt(params.id, 10);
    if (!piId) return NextResponse.json({ error: 'id inválido' }, { status: 400 });
    const body = await request.json();
    for (const field of ['fecha_inicio', 'dias_duracion', 'cantidad']) {
      if (!body[field]) {
        return NextResponse.json({ error: `Campo requerido: ${field}` }, { status: 400 });
      }
    }
    const sprints = await sprintsService.generarSprints(piId, body);
    return NextResponse.json(
      {
        success: true,
        data: sprints,
        message: `${body.cantidad} sprint(s) generado(s)`,
        timestamp: new Date().toISOString(),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error generando sprints:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al generar sprints' },
      { status: 500 }
    );
  }
}
