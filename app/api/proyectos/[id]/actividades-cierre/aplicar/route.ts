// app/api/proyectos/[id]/actividades-cierre/aplicar/route.ts
// Completa las funcionalidades ya existentes con las actividades de
// cierre de la lista que les falten.

import { NextResponse } from 'next/server';
import * as actividadesCierreService from '@/lib/services/actividadesCierreService';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const proyectoId = parseInt(params.id, 10);
    if (!proyectoId) return NextResponse.json({ error: 'id inválido' }, { status: 400 });
    const resultado = await actividadesCierreService.aplicarActividadesCierre(proyectoId);
    return NextResponse.json({ success: true, data: resultado, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('Error aplicando actividades de cierre:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al aplicar actividades de cierre' },
      { status: 500 }
    );
  }
}
