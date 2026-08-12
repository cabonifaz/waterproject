// app/api/proyectos/[id]/observaciones/route.ts
// Inventario completo de observaciones del proyecto — alimenta la página
// de filtros. El filtrado/orden se resuelve en el frontend sobre esta lista.

import { NextRequest, NextResponse } from 'next/server';
import * as inventarioObservacionesService from '@/lib/services/inventarioObservacionesService';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const proyectoId = parseInt(params.id, 10);
    const inventario = await inventarioObservacionesService.obtenerInventarioObservaciones(proyectoId);

    return NextResponse.json({ success: true, data: inventario, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('Error obteniendo inventario de observaciones:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al obtener el inventario' },
      { status: 500 }
    );
  }
}
