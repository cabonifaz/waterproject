// app/api/actividades-cierre/[id]/route.ts
// PATCH renombra (y corrige las HU de cierre ya creadas con el nombre
// anterior). DELETE la quita de la lista (las HU ya creadas quedan).

import { NextResponse } from 'next/server';
import * as actividadesCierreService from '@/lib/services/actividadesCierreService';

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const id = parseInt(params.id, 10);
    if (!id) return NextResponse.json({ error: 'id inválido' }, { status: 400 });
    const body = await request.json();
    const nombre = String(body.nombre ?? '').trim();
    if (!nombre) return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 });
    const actividad = await actividadesCierreService.renombrarActividadCierre(id, nombre);
    return NextResponse.json({ success: true, data: actividad, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('Error renombrando actividad de cierre:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al renombrar la actividad de cierre' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const id = parseInt(params.id, 10);
    if (!id) return NextResponse.json({ error: 'id inválido' }, { status: 400 });
    await actividadesCierreService.eliminarActividadCierre(id);
    return NextResponse.json({ success: true, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('Error eliminando actividad de cierre:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al eliminar la actividad de cierre' },
      { status: 500 }
    );
  }
}
