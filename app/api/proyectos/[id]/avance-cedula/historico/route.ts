// app/api/proyectos/[id]/avance-cedula/historico/route.ts
// Devuelve el corte de HOY (si ya se guardó) y el corte anterior a hoy
// (si existe), cada uno con su detalle — para comparar en la vista previa
// "cuánto se avanzó desde el corte anterior".

import { NextRequest, NextResponse } from 'next/server';
import * as cortesAvanceService from '@/lib/services/cortesAvanceService';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const proyectoId = parseInt(params.id, 10);
    const hoy = new Date().toISOString().slice(0, 10);

    const [corteHoy, corteAnterior] = await Promise.all([
      cortesAvanceService.obtenerCortePorFecha(proyectoId, hoy),
      cortesAvanceService.obtenerCorteAnterior(proyectoId, hoy),
    ]);

    const [detalleHoy, detalleAnterior] = await Promise.all([
      corteHoy ? cortesAvanceService.listarDetalleCorte(corteHoy.id) : Promise.resolve([]),
      corteAnterior ? cortesAvanceService.listarDetalleCorte(corteAnterior.id) : Promise.resolve([]),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        hoy,
        corteHoy,
        detalleHoy,
        corteAnterior,
        detalleAnterior,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error obteniendo histórico de avance:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al obtener el histórico' },
      { status: 500 }
    );
  }
}
