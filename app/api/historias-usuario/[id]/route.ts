// app/api/historias-usuario/[id]/route.ts
// Elimina (soft-delete) una historia de usuario: deja de listarse pero no
// se borra de la base, para poder recuperarla si fue un error.

import { NextResponse } from 'next/server';
import * as historiasUsuarioService from '@/lib/services/historiasUsuarioService';

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
