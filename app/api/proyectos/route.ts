// app/api/proyectos/route.ts

import { NextRequest, NextResponse } from 'next/server';
import * as proyectosService from '@/lib/services/proyectosService';
import * as plantillaService from '@/lib/services/plantillaService';
import * as cumplimientoService from '@/lib/services/cumplimientoService';
import { porcentaje, calcularSemaforo, topePorcentaje } from '@/lib/avanceCedula';

export async function GET() {
  try {
    const [proyectos, resumen] = await Promise.all([
      proyectosService.listarProyectos(),
      cumplimientoService.obtenerResumenCumplimientoProyectos(),
    ]);

    const resumenPorId = new Map(resumen.map((r) => [r.proyecto_id, r]));

    const proyectosConCumplimiento = proyectos.map((p) => {
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

    return NextResponse.json({
      success: true,
      data: proyectosConCumplimiento,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error listando proyectos:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al listar proyectos' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const required = ['nombre', 'fecha_inicio'];
    for (const field of required) {
      if (!body[field]) {
        return NextResponse.json({ error: `Campo requerido: ${field}` }, { status: 400 });
      }
    }

    const id = await proyectosService.crearProyecto(body);

    if (body.usarPlantilla !== false) {
      await plantillaService.aplicarPlantillaEstandar(id);
    }

    return NextResponse.json(
      {
        success: true,
        data: { id },
        message: 'Proyecto creado exitosamente',
        timestamp: new Date().toISOString(),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creando proyecto:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al crear proyecto' },
      { status: 500 }
    );
  }
}
