// app/api/epicas/[id]/route.ts
// Elimina (soft-delete) una épica: deja de listarse (y con ella sus HU),
// pero no se borra de la base, para poder recuperarla si fue un error.

import { NextResponse } from 'next/server';
import * as epicasService from '@/lib/services/epicasService';

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
