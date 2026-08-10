// app/api/modulos/[id]/importar-excel/route.ts
// Recibe un .xlsx (multipart/form-data, campo "archivo") y crea las
// épicas + HU del módulo en lote.

import { NextRequest, NextResponse } from 'next/server';
import * as importExcelService from '@/lib/services/importExcelService';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const moduloId = parseInt(params.id, 10);
    if (!moduloId) {
      return NextResponse.json({ error: 'id de módulo inválido' }, { status: 400 });
    }

    const formData = await request.formData();
    const archivo = formData.get('archivo');
    if (!(archivo instanceof Blob)) {
      return NextResponse.json({ error: 'Campo requerido: archivo (.xlsx)' }, { status: 400 });
    }

    const buffer = Buffer.from(await archivo.arrayBuffer());
    const resultado = await importExcelService.importarEpicasHU(moduloId, buffer);

    return NextResponse.json({
      success: true,
      data: resultado,
      message: `${resultado.epicasCreadas} épica(s) nueva(s), ${resultado.huCreadas} HU creada(s)`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error importando Excel:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al importar el Excel' },
      { status: 500 }
    );
  }
}
