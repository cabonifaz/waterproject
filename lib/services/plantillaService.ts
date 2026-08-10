// lib/services/plantillaService.ts
// Plantilla estándar que se aplica (opcionalmente) al crear un proyecto:
// Análisis y Diseño / Desarrollo Seguro (tareas matrices) -> Implementación
// (la única etapa de tipo 'desarrollo', vacía — módulos/épicas/HU se
// cargan a mano por proyecto) -> Cierre (tareas matrices finales). Todo lo
// que arma la plantilla queda editable después, como cualquier otra
// etapa/tarea creada a mano — no hay nada bloqueado ni de solo lectura.

import * as etapasService from './etapasService';
import * as tareasMatricesService from './tareasMatricesService';

interface EtapaPlantilla {
  nombre: string;
  tipo: 'desarrollo' | 'simple';
  tareasMatrices: string[];
}

// "Implementación" (no "Desarrollo") para no confundirse con la etapa
// "Desarrollo Seguro" (revisión de seguridad) — esta es la única etapa de
// tipo 'desarrollo': la que va a tener módulos -> épicas -> HU.
const PLANTILLA_ETAPAS: EtapaPlantilla[] = [
  {
    nombre: 'Análisis y Diseño',
    tipo: 'simple',
    tareasMatrices: [
      'Triaje de Seguridad',
      'Elaboración y Aprobación de Arquitectura',
      'Elaboración de Historias de Usuario y Refinamiento',
      'Documento con Controles de Cornucopia',
      'Evaluación Integral de Riesgos',
    ],
  },
  {
    nombre: 'Desarrollo Seguro',
    tipo: 'simple',
    tareasMatrices: ['Correcciones DAST', 'Documento con Evidencias de Cornucopia', 'Aprobación de Champions Sec.'],
  },
  {
    nombre: 'Implementación',
    tipo: 'desarrollo',
    tareasMatrices: [],
  },
  {
    nombre: 'Cierre',
    tipo: 'simple',
    tareasMatrices: [
      'Ejecución Ethical Hacking',
      'Comité Extraordinario de Riesgo Operacional',
      'Comité de Pase a Producción',
      'Pase a producción',
    ],
  },
];

export async function aplicarPlantillaEstandar(proyectoId: number): Promise<void> {
  for (let i = 0; i < PLANTILLA_ETAPAS.length; i++) {
    const etapaPlantilla = PLANTILLA_ETAPAS[i];
    const etapaId = await etapasService.crearEtapa({
      proyecto_id: proyectoId,
      nombre: etapaPlantilla.nombre,
      tipo: etapaPlantilla.tipo,
      orden: i + 1,
    });

    for (let j = 0; j < etapaPlantilla.tareasMatrices.length; j++) {
      await tareasMatricesService.crearTareaMatriz({
        etapa_id: etapaId,
        titulo: etapaPlantilla.tareasMatrices[j],
        orden: j + 1,
      });
    }
  }
}
