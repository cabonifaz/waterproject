// app/api/miembros/[id]/route.ts
// Elimina un miembro del proyecto (se desasigna automáticamente de
// cualquier HU/tarea matriz por FK ON DELETE CASCADE).

import { NextRequest, NextResponse } from 'next/server';
import * as miembrosService from '@/lib/services/miembrosService';

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
