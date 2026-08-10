// app/api/feriados/route.ts
// Feriados: lista global de fechas no laborables. GET lista todos, POST
// marca/desmarca una fecha (toggle) vía sp_marcar_feriado.

import { NextRequest, NextResponse } from 'next/server';
import * as feriadosService from '@/lib/services/feriadosService';

export async function GET() {
  try {
    const feriados = await feriadosService.listarFeriados();
    return NextResponse.json({
      success: true,
      data: feriados,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error listando feriados:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al listar feriados' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body.fecha) {
      return NextResponse.json({ error: 'Campo requerido: fecha' }, { status: 400 });
    }

    const feriados = await feriadosService.marcarFeriado(body.fecha);

    return NextResponse.json({
      success: true,
      data: feriados,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error marcando feriado:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al marcar feriado' },
      { status: 500 }
    );
  }
}
