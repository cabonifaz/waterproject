// app/api/tareas-matrices/route.ts

import { NextRequest, NextResponse } from 'next/server';
import * as tareasMatricesService from '@/lib/services/tareasMatricesService';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body.etapa_id || !body.titulo) {
      return NextResponse.json({ error: 'Campos requeridos: etapa_id, titulo' }, { status: 400 });
    }

    const id = await tareasMatricesService.crearTareaMatriz(body);

    return NextResponse.json(
      {
        success: true,
        data: { id },
        message: 'Tarea matriz creada exitosamente',
        timestamp: new Date().toISOString(),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creando tarea matriz:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al crear la tarea matriz' },
      { status: 500 }
    );
  }
}
