// app/api/pis/route.ts
// Programas Incrementales (PI). GET lista todos, POST crea uno.

import { NextRequest, NextResponse } from 'next/server';
import * as pisService from '@/lib/services/pisService';

export async function GET() {
  try {
    const pis = await pisService.listarPIs();
    return NextResponse.json({ success: true, data: pis, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('Error listando PIs:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al listar los PI' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body.nombre) {
      return NextResponse.json({ error: 'Campo requerido: nombre' }, { status: 400 });
    }
    const id = await pisService.crearPI(body);
    return NextResponse.json(
      { success: true, data: { id }, message: 'PI creado', timestamp: new Date().toISOString() },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creando PI:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al crear el PI' },
      { status: 500 }
    );
  }
}
