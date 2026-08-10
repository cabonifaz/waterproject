// app/api/proyectos/[id]/avance-cedula/cerrar/route.ts
// Guarda (o reemplaza) el corte de avance de HOY con las filas que manda
// el cliente — el cliente ya las recalculó en vivo con lib/avanceCedula.ts
// a partir de la estructura actual. Requiere confirmación explícita del
// usuario del lado del cliente antes de llamar a este endpoint.

import { NextRequest, NextResponse } from 'next/server';
import * as cortesAvanceService from '@/lib/services/cortesAvanceService';
import { FilaAvanceCedula } from '@/types';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const proyectoId = parseInt(params.id, 10);
    const body = await request.json();
    const filas: FilaAvanceCedula[] = body.filas;
    if (!Array.isArray(filas) || filas.length === 0) {
      return NextResponse.json({ error: 'Campo requerido: filas (no vacío)' }, { status: 400 });
    }

    const hoy = new Date().toISOString().slice(0, 10);
    const corteId = await cortesAvanceService.guardarCorte(proyectoId, hoy, filas);

    return NextResponse.json(
      {
        success: true,
        data: { id: corteId, fecha_corte: hoy },
        message: `Corte de avance del ${hoy} guardado`,
        timestamp: new Date().toISOString(),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error guardando corte de avance:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al guardar el corte' },
      { status: 500 }
    );
  }
}
