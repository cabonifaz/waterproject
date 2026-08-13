// app/api/proyectos/[id]/gantt/importar-plan-externo/route.ts
// Recibe un .xlsx externo (multipart/form-data, campos "archivo" y
// "hoja") con el formato de Plan de Trabajo por célula — distinto al que
// exporta esta app — y marca los días planificados de cada HU que
// matchea por código. Solo funciona con el planificado 'abierto'.

import { NextRequest, NextResponse } from 'next/server';
import * as importPlanExternoService from '@/lib/services/importPlanExternoService';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const proyectoId = parseInt(params.id, 10);
    if (!proyectoId) {
      return NextResponse.json({ error: 'id de proyecto inválido' }, { status: 400 });
    }

    const formData = await request.formData();
    const archivo = formData.get('archivo');
    const hoja = formData.get('hoja');
    if (!(archivo instanceof Blob)) {
      return NextResponse.json({ error: 'Campo requerido: archivo (.xlsx)' }, { status: 400 });
    }
    if (typeof hoja !== 'string' || !hoja) {
      return NextResponse.json({ error: 'Campo requerido: hoja (nombre de la hoja a importar)' }, { status: 400 });
    }

    const buffer = Buffer.from(await archivo.arrayBuffer());
    const resultado = await importPlanExternoService.importarPlanExterno(proyectoId, buffer, hoja);

    return NextResponse.json({ success: true, data: resultado, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('Error importando plan de trabajo externo:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al importar el plan de trabajo' },
      { status: 500 }
    );
  }
}
