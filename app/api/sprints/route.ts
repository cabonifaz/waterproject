// app/api/sprints/route.ts
// Sprints: plantilla global (no por proyecto). GET lista todos, POST genera
// más en lote (fecha inicio + duración en días + cantidad) — si ya hay
// sprints cargados, sigue numerando a partir del último.

import { NextRequest, NextResponse } from 'next/server';
import * as sprintsService from '@/lib/services/sprintsService';

export async function GET() {
  try {
    const sprints = await sprintsService.listarSprints();
    return NextResponse.json({
      success: true,
      data: sprints,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error listando sprints:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al listar sprints' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const required = ['fecha_inicio', 'dias_duracion', 'cantidad'];
    for (const field of required) {
      if (!body[field]) {
        return NextResponse.json({ error: `Campo requerido: ${field}` }, { status: 400 });
      }
    }

    const sprints = await sprintsService.generarSprints(body);

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
