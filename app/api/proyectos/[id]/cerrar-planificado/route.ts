// app/api/proyectos/[id]/cerrar-planificado/route.ts
// Cierra el planificado del proyecto: bloquea el marcado de días en el
// Gantt y, la primera vez, captura el baseline (planificado inicial).

import { NextRequest, NextResponse } from 'next/server';
import * as proyectosService from '@/lib/services/proyectosService';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = parseInt(params.id, 10);
    const proyecto = await proyectosService.cerrarPlanificado(id);
    return NextResponse.json({
      success: true,
      data: proyecto,
      message: 'Planificado cerrado',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error cerrando planificado:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al cerrar el planificado' },
      { status: 500 }
    );
  }
}
