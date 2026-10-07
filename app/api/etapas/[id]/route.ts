// app/api/etapas/[id]/route.ts
// PATCH { activa: boolean }: desactiva o reactiva una etapa (ej. "Cierre"
// del proyecto cuando cada módulo ya tiene su propio cierre). No borra
// nada; la etapa de Desarrollo no se puede desactivar.

import { NextResponse } from 'next/server';
import * as etapasService from '@/lib/services/etapasService';

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const id = parseInt(params.id, 10);
    if (!id) return NextResponse.json({ error: 'id inválido' }, { status: 400 });
    const body = await request.json();
    if (typeof body.activa !== 'boolean') {
      return NextResponse.json({ error: 'Campo requerido: activa (true/false)' }, { status: 400 });
    }
    const etapa = await etapasService.cambiarEstadoEtapa(id, body.activa);
    return NextResponse.json({ success: true, data: etapa, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('Error cambiando estado de etapa:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al cambiar el estado de la etapa' },
      { status: 500 }
    );
  }
}
