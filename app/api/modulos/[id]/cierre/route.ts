// app/api/modulos/[id]/cierre/route.ts
// Agrega (o completa) el bloque "Cierre del módulo" al final del módulo,
// con las actividades de la lista de cierre de módulo del proyecto.

import { NextResponse } from 'next/server';
import * as actividadesCierreService from '@/lib/services/actividadesCierreService';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const moduloId = parseInt(params.id, 10);
    if (!moduloId) return NextResponse.json({ error: 'id inválido' }, { status: 400 });
    const epicaId = await actividadesCierreService.agregarCierreModulo(moduloId);
    return NextResponse.json({ success: true, data: { epica_id: epicaId }, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('Error agregando cierre de módulo:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al agregar el cierre del módulo' },
      { status: 500 }
    );
  }
}
