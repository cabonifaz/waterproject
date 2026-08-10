// app/api/historias-usuario/route.ts

import { NextRequest, NextResponse } from 'next/server';
import * as historiasUsuarioService from '@/lib/services/historiasUsuarioService';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body.epica_id || !body.titulo) {
      return NextResponse.json({ error: 'Campos requeridos: epica_id, titulo' }, { status: 400 });
    }

    const id = await historiasUsuarioService.crearHistoriaUsuario(body);

    return NextResponse.json(
      {
        success: true,
        data: { id },
        message: 'Historia de usuario creada exitosamente',
        timestamp: new Date().toISOString(),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creando historia de usuario:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al crear la historia de usuario' },
      { status: 500 }
    );
  }
}
