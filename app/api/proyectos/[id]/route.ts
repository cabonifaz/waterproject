// app/api/proyectos/[id]/route.ts

import { NextResponse } from 'next/server';
import * as proyectosService from '@/lib/services/proyectosService';

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const id = parseInt(params.id, 10);
    if (!id) {
      return NextResponse.json({ error: 'id inválido' }, { status: 400 });
    }
    const proyecto = await proyectosService.obtenerProyecto(id);
    if (!proyecto) {
      return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 });
    }
    return NextResponse.json({
      success: true,
      data: proyecto,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error obteniendo proyecto:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al obtener el proyecto' },
      { status: 500 }
    );
  }
}

// Elimina el proyecto completo (etapas, módulos, épicas, HU, tareas
// matrices, sprints y días planificados se borran en cascada).
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const id = parseInt(params.id, 10);
    if (!id) {
      return NextResponse.json({ error: 'id inválido' }, { status: 400 });
    }

    await proyectosService.eliminarProyecto(id);

    return NextResponse.json({
      success: true,
      message: 'Proyecto eliminado',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error eliminando proyecto:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al eliminar el proyecto' },
      { status: 500 }
    );
  }
}
