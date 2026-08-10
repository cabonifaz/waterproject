// app/api/historias-usuario/[id]/dias-reales/route.ts
// Marca/togglea un día del Gantt REAL para una HU. El servidor rechaza el
// cambio si el planificado del proyecto no está 'cerrado'.

import { NextRequest, NextResponse } from 'next/server';
import * as diasRealesService from '@/lib/services/diasRealesService';

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

    const dias = await diasRealesService.marcarDiaHURealidad(historiaUsuarioId, fecha, tipo_marca);

    return NextResponse.json({
      success: true,
      data: dias,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error marcando día real de HU:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al marcar el día real' },
      { status: 500 }
    );
  }
}
