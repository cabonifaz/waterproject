// app/api/reordenar/route.ts
// Reordena hermanos: body { tipo, ids } con los ids en el orden deseado.

import { NextRequest, NextResponse } from 'next/server';
import * as ordenService from '@/lib/services/ordenService';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tipo, ids } = body;
    if (!ordenService.TIPOS_REORDENABLES.includes(tipo)) {
      return NextResponse.json({ error: 'tipo inválido' }, { status: 400 });
    }
    if (!Array.isArray(ids) || ids.length === 0 || !ids.every((id) => Number.isInteger(id) && id > 0)) {
      return NextResponse.json({ error: 'ids debe ser una lista de ids' }, { status: 400 });
    }

    await ordenService.reordenar(tipo, ids);

    return NextResponse.json({ success: true, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('Error reordenando:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al reordenar' },
      { status: 500 }
    );
  }
}
