// app/api/proyectos/[id]/observaciones/cortes/route.ts
// GET lista el historial de cortes guardados; POST guarda uno nuevo con
// los conteos actuales (HU con observaciones / abiertas / certificadas).

import { NextRequest, NextResponse } from 'next/server';
import * as cortesObservacionesService from '@/lib/services/cortesObservacionesService';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const proyectoId = parseInt(params.id, 10);
    const cortes = await cortesObservacionesService.listarCortes(proyectoId);

    return NextResponse.json({ success: true, data: cortes, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('Error listando cortes de observaciones:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al listar los cortes' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const proyectoId = parseInt(params.id, 10);
    const corte = await cortesObservacionesService.guardarCorte(proyectoId);

    return NextResponse.json(
      { success: true, data: corte, timestamp: new Date().toISOString() },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error guardando corte de observaciones:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al guardar el corte' },
      { status: 500 }
    );
  }
}
