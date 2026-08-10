// app/api/historias-usuario/[id]/dias/route.ts
// Marca/togglea un día del Gantt planificado para una HU
// (desarrollo | certificacion | cierre)

import { NextRequest, NextResponse } from 'next/server';
import * as diasPlanificadosService from '@/lib/services/diasPlanificadosService';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const historiaUsuarioId = parseInt(params.id, 10);
    if (!historiaUsuarioId) {
      return NextResponse.json({ error: 'id inválido' }, { status: 400 });
    }

    const body = await request.json();
    const { fecha, tipo_marca } = body;
    if (!fecha || !tipo_marca) {
      return NextResponse.json({ error: 'Campos requeridos: fecha, tipo_marca' }, { status: 400 });
    }
    if (!['desarrollo', 'certificacion', 'cierre'].includes(tipo_marca)) {
      return NextResponse.json({ error: 'tipo_marca inválido' }, { status: 400 });
    }

    const dias = await diasPlanificadosService.marcarDiaHU(historiaUsuarioId, fecha, tipo_marca);

    return NextResponse.json({
      success: true,
      data: dias,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error marcando día de HU:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al marcar el día' },
      { status: 500 }
    );
  }
}
