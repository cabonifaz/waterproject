// app/api/miembros/[id]/route.ts
// Elimina un miembro del proyecto (se desasigna automáticamente de
// cualquier HU/tarea matriz por FK ON DELETE CASCADE).

import { NextRequest, NextResponse } from 'next/server';
import * as miembrosService from '@/lib/services/miembrosService';

// PATCH { es_cross: boolean }: marca / desmarca al talento como "cross"
// (no genera alertas de superposición de tareas).
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = parseInt(params.id, 10);
    if (!id) return NextResponse.json({ error: 'id inválido' }, { status: 400 });
    const body = await request.json();
    if (typeof body.es_cross !== 'boolean') {
      return NextResponse.json({ error: 'Campo requerido: es_cross (true/false)' }, { status: 400 });
    }
    const miembro = await miembrosService.marcarMiembroCross(id, body.es_cross);
    return NextResponse.json({ success: true, data: miembro, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('Error actualizando miembro:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al actualizar el miembro' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = parseInt(params.id, 10);
    await miembrosService.eliminarMiembro(id);
    return NextResponse.json({
      success: true,
      message: 'Miembro eliminado',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error eliminando miembro:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al eliminar miembro' },
      { status: 500 }
    );
  }
}
