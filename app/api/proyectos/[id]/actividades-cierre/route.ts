// app/api/proyectos/[id]/actividades-cierre/route.ts
// Lista de actividades de cierre por funcionalidad del proyecto.
// GET: { auto, actividades }. PUT: activa/desactiva la auto-creación.
// POST: agrega un nombre a la lista.

import { NextRequest, NextResponse } from 'next/server';
import * as actividadesCierreService from '@/lib/services/actividadesCierreService';
import * as proyectosService from '@/lib/services/proyectosService';

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const proyectoId = parseInt(params.id, 10);
    if (!proyectoId) return NextResponse.json({ error: 'id inválido' }, { status: 400 });
    const [proyecto, actividades] = await Promise.all([
      proyectosService.obtenerProyecto(proyectoId),
      actividadesCierreService.listarActividadesCierre(proyectoId),
    ]);
    if (!proyecto) return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 });
    return NextResponse.json({
      success: true,
      data: { auto: !!proyecto.auto_actividades_cierre, actividades },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error listando actividades de cierre:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al listar actividades de cierre' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const proyectoId = parseInt(params.id, 10);
    if (!proyectoId) return NextResponse.json({ error: 'id inválido' }, { status: 400 });
    const body = await request.json();
    await actividadesCierreService.configurarAutoActividadesCierre(proyectoId, !!body.auto);
    return NextResponse.json({ success: true, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('Error configurando actividades de cierre:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al configurar actividades de cierre' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const proyectoId = parseInt(params.id, 10);
    if (!proyectoId) return NextResponse.json({ error: 'id inválido' }, { status: 400 });
    const body = await request.json();
    const nombre = String(body.nombre ?? '').trim();
    if (!nombre) return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 });
    const actividad = await actividadesCierreService.crearActividadCierre(proyectoId, nombre);
    return NextResponse.json({ success: true, data: actividad, timestamp: new Date().toISOString() }, { status: 201 });
  } catch (error) {
    console.error('Error creando actividad de cierre:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al crear la actividad de cierre' },
      { status: 500 }
    );
  }
}
