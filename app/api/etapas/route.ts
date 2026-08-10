// app/api/etapas/route.ts

import { NextRequest, NextResponse } from 'next/server';
import * as etapasService from '@/lib/services/etapasService';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body.proyecto_id || !body.nombre) {
      return NextResponse.json({ error: 'Campos requeridos: proyecto_id, nombre' }, { status: 400 });
    }

    const id = await etapasService.crearEtapa(body);

    return NextResponse.json(
      {
        success: true,
        data: { id },
        message: 'Etapa creada exitosamente',
        timestamp: new Date().toISOString(),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creando etapa:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al crear etapa' },
      { status: 500 }
    );
  }
}
