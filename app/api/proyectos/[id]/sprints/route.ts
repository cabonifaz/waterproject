// app/api/proyectos/[id]/sprints/route.ts
// Sprints que le corresponden a un proyecto = los del PI al que pertenece.
// Es lo que consume el Gantt (planificado y real).

import { NextResponse } from 'next/server';
import * as sprintsService from '@/lib/services/sprintsService';

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const id = parseInt(params.id, 10);
    if (!id) return NextResponse.json({ error: 'id inválido' }, { status: 400 });
    const sprints = await sprintsService.listarSprintsProyecto(id);
    return NextResponse.json({ success: true, data: sprints, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('Error listando sprints del proyecto:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al listar sprints del proyecto' },
      { status: 500 }
    );
  }
}
