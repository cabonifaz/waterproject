// app/api/celulas/[id]/route.ts
// PATCH renombra una célula, DELETE la elimina (los proyectos que la
// tenían quedan con celula_id = NULL).

import { NextRequest, NextResponse } from 'next/server';
import * as celulasService from '@/lib/services/celulasService';

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = parseInt(params.id, 10);
    if (!id) return NextResponse.json({ error: 'id inválido' }, { status: 400 });
    const body = await request.json();
    if (!body.nombre) return NextResponse.json({ error: 'Campo requerido: nombre' }, { status: 400 });
    const celula = await celulasService.renombrarCelula(id, body.nombre);
    return NextResponse.json({ success: true, data: celula, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('Error renombrando célula:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al renombrar la célula' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const id = parseInt(params.id, 10);
    if (!id) return NextResponse.json({ error: 'id inválido' }, { status: 400 });
    await celulasService.eliminarCelula(id);
    return NextResponse.json({ success: true, message: 'Célula eliminada', timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('Error eliminando célula:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al eliminar la célula' },
      { status: 500 }
    );
  }
}
