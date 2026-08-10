// app/api/historias-usuario/[id]/cerrar/route.ts
// Marca una historia de usuario como cerrada (certificada)

import { NextResponse } from 'next/server';
import * as historiasUsuarioService from '@/lib/services/historiasUsuarioService';

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const id = parseInt(params.id, 10);
    if (!id) {
      return NextResponse.json({ error: 'id inválido' }, { status: 400 });
    }

    const historia = await historiasUsuarioService.cerrarHistoriaUsuario(id);

    return NextResponse.json({
      success: true,
      data: historia,
      message: 'Historia de usuario cerrada',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error cerrando historia de usuario:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al cerrar la historia de usuario' },
      { status: 500 }
    );
  }
}
