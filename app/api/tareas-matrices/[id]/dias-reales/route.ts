// app/api/tareas-matrices/[id]/dias-reales/route.ts
// Marca/togglea un día del Gantt REAL para una tarea matriz. El servidor
// rechaza el cambio si el planificado del proyecto no está 'cerrado'.

import { NextRequest, NextResponse } from 'next/server';
import * as diasRealesService from '@/lib/services/diasRealesService';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const tareaMatrizId = parseInt(params.id, 10);
    if (!tareaMatrizId) {
      return NextResponse.json({ error: 'id inválido' }, { status: 400 });
    }

    const body = await request.json();
    const { fecha, tipo_marca } = body;
    if (!fecha || !tipo_marca) {
      return NextResponse.json({ error: 'Campos requeridos: fecha, tipo_marca' }, { status: 400 });
    }
    if (!['trabajo', 'cierre'].includes(tipo_marca)) {
      return NextResponse.json({ error: 'tipo_marca inválido' }, { status: 400 });
    }

    const dias = await diasRealesService.marcarDiaTareaMatrizRealidad(tareaMatrizId, fecha, tipo_marca);

    return NextResponse.json({
      success: true,
      data: dias,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error marcando día real de tarea matriz:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al marcar el día real' },
      { status: 500 }
    );
  }
}
