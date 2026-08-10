// app/api/proyectos/[id]/gantt-real/importar-excel/route.ts
// Recibe un .xlsx (multipart/form-data, campo "archivo") — el mismo
// formato que exporta el Gantt Real — y sincroniza sus marcas con la base
// de datos. Solo funciona mientras el planificado está 'cerrado'.

import { NextRequest, NextResponse } from 'next/server';
import * as importGanttExcelService from '@/lib/services/importGanttExcelService';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const proyectoId = parseInt(params.id, 10);
    if (!proyectoId) {
      return NextResponse.json({ error: 'id de proyecto inválido' }, { status: 400 });
    }

    const formData = await request.formData();
    const archivo = formData.get('archivo');
    if (!(archivo instanceof Blob)) {
      return NextResponse.json({ error: 'Campo requerido: archivo (.xlsx)' }, { status: 400 });
    }

    const buffer = Buffer.from(await archivo.arrayBuffer());
    const resultado = await importGanttExcelService.importarGanttExcel(proyectoId, buffer, 'real');

    return NextResponse.json({ success: true, data: resultado, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('Error importando Excel del Gantt real:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al importar el Excel' },
      { status: 500 }
    );
  }
}
