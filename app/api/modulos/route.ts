// app/api/modulos/route.ts

import { NextRequest, NextResponse } from 'next/server';
import * as modulosService from '@/lib/services/modulosService';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body.etapa_id || !body.nombre) {
      return NextResponse.json({ error: 'Campos requeridos: etapa_id, nombre' }, { status: 400 });
    }

    const id = await modulosService.crearModulo(body);

    return NextResponse.json(
      {
        success: true,
        data: { id },
        message: 'Módulo creado exitosamente',
        timestamp: new Date().toISOString(),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creando módulo:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al crear módulo' },
      { status: 500 }
    );
  }
}
