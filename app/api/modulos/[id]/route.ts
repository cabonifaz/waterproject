// app/api/modulos/[id]/route.ts
// Renombra un módulo.

import { NextResponse } from 'next/server';
import * as modulosService from '@/lib/services/modulosService';

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const id = parseInt(params.id, 10);
    if (!id) {
      return NextResponse.json({ error: 'id inválido' }, { status: 400 });
    }
    const body = await request.json();
    const nombre = String(body.nombre ?? '').trim();
    if (!nombre) {
      return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 });
    }

    const modulo = await modulosService.renombrarModulo(id, nombre);

    return NextResponse.json({ success: true, data: modulo, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('Error renombrando módulo:', error);
    const duplicado = error instanceof Error && error.message.includes('Duplicate entry');
    return NextResponse.json(
      {
        error: duplicado
          ? 'Ya existe un módulo con ese nombre en la etapa.'
          : error instanceof Error
          ? error.message
          : 'Error al renombrar el módulo',
      },
      { status: duplicado ? 409 : 500 }
    );
  }
}
