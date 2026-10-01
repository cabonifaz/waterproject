// app/api/epicas/[id]/route.ts
// Elimina (soft-delete) una épica: deja de listarse (y con ella sus HU),
// pero no se borra de la base, para poder recuperarla si fue un error.

import { NextResponse } from 'next/server';
import * as epicasService from '@/lib/services/epicasService';

// Renombra la épica / funcionalidad.
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

    const epica = await epicasService.renombrarEpica(id, nombre);

    return NextResponse.json({ success: true, data: epica, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('Error renombrando épica:', error);
    // La unique key (modulo_id, nombre) incluye también las épicas eliminadas.
    const duplicada = error instanceof Error && error.message.includes('Duplicate entry');
    return NextResponse.json(
      {
        error: duplicada
          ? 'Ya existe una épica con ese nombre en el módulo (puede estar eliminada).'
          : error instanceof Error
          ? error.message
          : 'Error al renombrar la épica',
      },
      { status: duplicada ? 409 : 500 }
    );
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const id = parseInt(params.id, 10);
    if (!id) {
      return NextResponse.json({ error: 'id inválido' }, { status: 400 });
    }

    await epicasService.eliminarEpica(id);

    return NextResponse.json({
      success: true,
      message: 'Épica eliminada',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error eliminando épica:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al eliminar la épica' },
      { status: 500 }
    );
  }
}
