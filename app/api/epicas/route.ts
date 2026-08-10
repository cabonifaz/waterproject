// app/api/epicas/route.ts

import { NextRequest, NextResponse } from 'next/server';
import * as epicasService from '@/lib/services/epicasService';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body.modulo_id || !body.nombre) {
      return NextResponse.json({ error: 'Campos requeridos: modulo_id, nombre' }, { status: 400 });
    }

    const id = await epicasService.crearEpica(body);

    return NextResponse.json(
      {
        success: true,
        data: { id },
        message: 'Épica creada exitosamente',
        timestamp: new Date().toISOString(),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creando épica:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al crear épica' },
      { status: 500 }
    );
  }
}
