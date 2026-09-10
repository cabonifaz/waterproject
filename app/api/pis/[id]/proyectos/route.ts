// app/api/pis/[id]/proyectos/route.ts
// Proyectos de un PI (con nombre de célula) + % de cumplimiento y semáforo
// calculados igual que en la vieja lista global de proyectos.

import { NextResponse } from 'next/server';
import * as proyectosService from '@/lib/services/proyectosService';
import * as cumplimientoService from '@/lib/services/cumplimientoService';
import { porcentaje, calcularSemaforo, topePorcentaje } from '@/lib/avanceCedula';

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const piId = parseInt(params.id, 10);
    if (!piId) return NextResponse.json({ error: 'id inválido' }, { status: 400 });

    const [proyectos, resumen] = await Promise.all([
      proyectosService.listarProyectosPI(piId),
      cumplimientoService.obtenerResumenCumplimientoProyectos(),
    ]);

    const resumenPorId = new Map(resumen.map((r) => [r.proyecto_id, r]));

    const data = proyectos.map((p) => {
      const r = resumenPorId.get(p.id);
      const diasPlanificados = r?.dias_planificados || 0;
      const diasReales = r?.dias_reales || 0;
      const totalActividades = r?.total_actividades || 0;
      const actividadesCerradas = r?.actividades_cerradas || 0;
      const cerrado = totalActividades > 0 && actividadesCerradas === totalActividades;
      return {
        ...p,
        porcentajeCumplimiento: topePorcentaje(porcentaje(diasReales, diasPlanificados), cerrado),
        semaforo: calcularSemaforo(diasPlanificados, diasReales, cerrado),
      };
    });

    return NextResponse.json({ success: true, data, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('Error listando proyectos del PI:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al listar proyectos del PI' },
      { status: 500 }
    );
  }
}
