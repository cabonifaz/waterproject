// app/api/pis/[id]/carga/route.ts
// Datos para la vista de carga del equipo de todo el PI: la estructura
// (con días y talentos) de cada proyecto del PI y los sprints del PI.

import { NextResponse } from 'next/server';
import * as proyectosService from '@/lib/services/proyectosService';
import * as sprintsService from '@/lib/services/sprintsService';
import * as estructuraService from '@/lib/services/estructuraService';

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const piId = parseInt(params.id, 10);
    if (!piId) return NextResponse.json({ error: 'id inválido' }, { status: 400 });

    const [proyectos, sprints] = await Promise.all([
      proyectosService.listarProyectosPI(piId),
      sprintsService.listarSprintsPI(piId),
    ]);
    const fuentes = [];
    for (const p of proyectos) {
      const estructura = await estructuraService.obtenerEstructuraProyecto(p.id);
      if (estructura) fuentes.push({ proyecto: { id: p.id, nombre: p.nombre }, estructura });
    }

    return NextResponse.json({ success: true, data: { fuentes, sprints }, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('Error obteniendo carga del equipo del PI:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al obtener la carga del equipo' },
      { status: 500 }
    );
  }
}
