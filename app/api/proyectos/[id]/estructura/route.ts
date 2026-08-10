// app/api/proyectos/[id]/estructura/route.ts

import { NextRequest, NextResponse } from 'next/server';
import * as estructuraService from '@/lib/services/estructuraService';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const proyectoId = parseInt(params.id, 10);
    if (!proyectoId) {
      return NextResponse.json({ error: 'id de proyecto inválido' }, { status: 400 });
    }

    const estructura = await estructuraService.obtenerEstructuraProyecto(proyectoId);
    if (!estructura) {
      return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: estructura,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error obteniendo estructura del proyecto:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al obtener la estructura' },
      { status: 500 }
    );
  }
}
