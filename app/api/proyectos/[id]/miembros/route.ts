// app/api/proyectos/[id]/miembros/route.ts
// Miembros de un proyecto: GET lista, POST crea (nombre + iniciales).

import { NextRequest, NextResponse } from 'next/server';
import * as miembrosService from '@/lib/services/miembrosService';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const proyectoId = parseInt(params.id, 10);
    const miembros = await miembrosService.listarMiembrosProyecto(proyectoId);
    return NextResponse.json({
      success: true,
      data: miembros,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error listando miembros:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al listar miembros' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const proyectoId = parseInt(params.id, 10);
    const body = await request.json();
    const { nombre, iniciales } = body;
    if (!nombre || !iniciales) {
      return NextResponse.json({ error: 'Campos requeridos: nombre, iniciales' }, { status: 400 });
    }

    const id = await miembrosService.crearMiembro({ proyecto_id: proyectoId, nombre, iniciales });

    return NextResponse.json(
      {
        success: true,
        data: { id },
        message: 'Miembro agregado exitosamente',
        timestamp: new Date().toISOString(),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creando miembro:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al crear miembro' },
      { status: 500 }
    );
  }
}
