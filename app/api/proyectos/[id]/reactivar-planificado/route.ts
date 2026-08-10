// app/api/proyectos/[id]/reactivar-planificado/route.ts
// Reactiva el planificado (Control de Cambios) para poder seguir
// marcando días en el Gantt sin perder el baseline ya capturado.

import { NextRequest, NextResponse } from 'next/server';
import * as proyectosService from '@/lib/services/proyectosService';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = parseInt(params.id, 10);
    const proyecto = await proyectosService.reactivarPlanificado(id);
    return NextResponse.json({
      success: true,
      data: proyecto,
      message: 'Planificado reactivado — Control de Cambios',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error reactivando planificado:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al reactivar el planificado' },
      { status: 500 }
    );
  }
}
