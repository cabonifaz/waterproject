// app/api/tareas-matrices/[id]/route.ts
// Edita título/descripción de una tarea matriz.

import { NextResponse } from 'next/server';
import * as tareasMatricesService from '@/lib/services/tareasMatricesService';

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const id = parseInt(params.id, 10);
    if (!id) {
      return NextResponse.json({ error: 'id inválido' }, { status: 400 });
    }
    const body = await request.json();
    const titulo = String(body.titulo ?? '').trim();
    if (!titulo) {
      return NextResponse.json({ error: 'El título es obligatorio' }, { status: 400 });
    }

    const tarea = await tareasMatricesService.actualizarTareaMatriz(id, {
      titulo,
      descripcion: body.descripcion ? String(body.descripcion) : null,
    });

    return NextResponse.json({ success: true, data: tarea, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('Error actualizando tarea matriz:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al actualizar la tarea matriz' },
      { status: 500 }
    );
  }
}
