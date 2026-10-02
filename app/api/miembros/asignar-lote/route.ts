// app/api/miembros/asignar-lote/route.ts
// Asigna talentos (miembros) a un grupo de actividades de una vez.
// body: { hu_ids, tarea_ids, miembro_ids, accion: 'agregar'|'quitar'|'reemplazar' }

import { NextRequest, NextResponse } from 'next/server';
import * as miembrosService from '@/lib/services/miembrosService';

const esListaIds = (v: unknown): v is number[] =>
  Array.isArray(v) && v.every((id) => Number.isInteger(id) && id > 0);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const huIds = body.hu_ids ?? [];
    const tareaIds = body.tarea_ids ?? [];
    const miembroIds = body.miembro_ids ?? [];
    const accion = body.accion;

    if (!['agregar', 'quitar', 'reemplazar'].includes(accion)) {
      return NextResponse.json({ error: 'accion inválida' }, { status: 400 });
    }
    if (!esListaIds(huIds) || !esListaIds(tareaIds) || !esListaIds(miembroIds)) {
      return NextResponse.json({ error: 'hu_ids, tarea_ids y miembro_ids deben ser listas de ids' }, { status: 400 });
    }
    if (huIds.length + tareaIds.length === 0) {
      return NextResponse.json({ error: 'Seleccioná al menos una actividad' }, { status: 400 });
    }
    if (miembroIds.length === 0 && accion !== 'reemplazar') {
      return NextResponse.json({ error: 'Seleccioná al menos un talento' }, { status: 400 });
    }

    await miembrosService.asignarMiembrosLote({ huIds, tareaIds, miembroIds, accion });

    return NextResponse.json({ success: true, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('Error asignando miembros en lote:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al asignar talentos' },
      { status: 500 }
    );
  }
}
