// app/api/pis/[id]/route.ts
// GET obtiene un PI, PATCH lo actualiza, DELETE lo elimina (rechaza si
// tiene proyectos asignados).

import { NextRequest, NextResponse } from 'next/server';
import * as pisService from '@/lib/services/pisService';

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const id = parseInt(params.id, 10);
    if (!id) return NextResponse.json({ error: 'id inválido' }, { status: 400 });
    const pi = await pisService.obtenerPI(id);
    if (!pi) return NextResponse.json({ error: 'PI no encontrado' }, { status: 404 });
    return NextResponse.json({ success: true, data: pi, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('Error obteniendo PI:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al obtener el PI' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = parseInt(params.id, 10);
    if (!id) return NextResponse.json({ error: 'id inválido' }, { status: 400 });
    const body = await request.json();
    if (!body.nombre) return NextResponse.json({ error: 'Campo requerido: nombre' }, { status: 400 });
    const pi = await pisService.actualizarPI(id, {
      nombre: body.nombre,
      fecha_inicio: body.fecha_inicio ?? null,
      estado: body.estado === 'cerrado' ? 'cerrado' : 'activo',
    });
    return NextResponse.json({ success: true, data: pi, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('Error actualizando PI:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al actualizar el PI' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const id = parseInt(params.id, 10);
    if (!id) return NextResponse.json({ error: 'id inválido' }, { status: 400 });
    await pisService.eliminarPI(id);
    return NextResponse.json({ success: true, message: 'PI eliminado', timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('Error eliminando PI:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al eliminar el PI' },
      { status: 500 }
    );
  }
}
