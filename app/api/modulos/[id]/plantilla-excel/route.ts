// app/api/modulos/[id]/plantilla-excel/route.ts
// Descarga la plantilla .xlsx (columnas Épica/Código/Título/Descripción/
// Prioridad) para cargar épicas + HU en lote.

import { NextResponse } from 'next/server';
import * as importExcelService from '@/lib/services/importExcelService';

export async function GET() {
  try {
    const buffer = await importExcelService.generarPlantillaExcel();
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="plantilla-epicas-hu.xlsx"',
      },
    });
  } catch (error) {
    console.error('Error generando plantilla Excel:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al generar la plantilla' },
      { status: 500 }
    );
  }
}
