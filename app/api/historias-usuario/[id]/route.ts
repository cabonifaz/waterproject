// app/api/historias-usuario/[id]/route.ts
// PATCH edita los datos de la HU (código, título, descripción, prioridad)
// desde el modal de la pantalla de estructura. DELETE la elimina
// (soft-delete): deja de listarse pero no se borra de la base, para poder
// recuperarla si fue un error.

import { NextResponse } from 'next/server';
import * as historiasUsuarioService from '@/lib/services/historiasUsuarioService';

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
    if (body.prioridad && !['baja', 'media', 'alta'].includes(body.prioridad)) {
      return NextResponse.json({ error: 'prioridad inválida' }, { status: 400 });
    }

    const hu = await historiasUsuarioService.actualizarHistoriaUsuario(id, {
      codigo: body.codigo ? String(body.codigo).trim() : null,
      titulo,
      descripcion: body.descripcion ? String(body.descripcion) : null,
      prioridad: body.prioridad || null,
    });

    return NextResponse.json({ success: true, data: hu, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('Error actualizando historia de usuario:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al actualizar la historia de usuario' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const id = parseInt(params.id, 10);
    if (!id) {
      return NextResponse.json({ error: 'id inválido' }, { status: 400 });
    }

    await historiasUsuarioService.eliminarHistoriaUsuario(id);

    return NextResponse.json({
      success: true,
      message: 'Historia de usuario eliminada',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error eliminando historia de usuario:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al eliminar la historia de usuario' },
      { status: 500 }
    );
  }
}
