// app/api/pis/[id]/celulas/route.ts
// Células de un PI. GET lista, POST crea.

import { NextRequest, NextResponse } from 'next/server';
import * as celulasService from '@/lib/services/celulasService';

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const piId = parseInt(params.id, 10);
    if (!piId) return NextResponse.json({ error: 'id inválido' }, { status: 400 });
    const celulas = await celulasService.listarCelulasPI(piId);
    return NextResponse.json({ success: true, data: celulas, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('Error listando células:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al listar las células' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const piId = parseInt(params.id, 10);
    if (!piId) return NextResponse.json({ error: 'id inválido' }, { status: 400 });
    const body = await request.json();
    if (!body.nombre) return NextResponse.json({ error: 'Campo requerido: nombre' }, { status: 400 });
    const celula = await celulasService.crearCelula(piId, body.nombre);
    return NextResponse.json(
      { success: true, data: celula, message: 'Célula creada', timestamp: new Date().toISOString() },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creando célula:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al crear la célula' },
      { status: 500 }
    );
  }
}
