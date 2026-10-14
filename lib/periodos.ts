// lib/periodos.ts
// Nombres de los períodos de un PI (tabla sprints) y rótulos de la fila de
// meses, compartidos por los Gantt, el Excel y la carga del equipo:
//   - 'sprint'       -> "Sprint N"
//   - 'priorizacion' -> "Zona Gris" (al inicio y/o al final del PI); en la
//                       fila de meses: "Priorización <mes en que termina>"
//   - 'cierre'       -> "Zona Gris" de actividades finales del proyecto (ej.
//                       enero, después de la priorización de diciembre); en
//                       la fila de meses va el mes normal.

import { Sprint } from '@/types';

export const esZonaGris = (s: Pick<Sprint, 'tipo'>) => s.tipo !== 'sprint';

// Rótulo de la fila de sprints.
export const etiquetaPeriodo = (s: Pick<Sprint, 'tipo' | 'numero'>) => (esZonaGris(s) ? 'Zona Gris' : `Sprint ${s.numero}`);

// Nombre descriptivo (pantallas de administración de sprints).
export const nombrePeriodo = (s: Pick<Sprint, 'tipo' | 'numero'>) =>
  s.tipo === 'priorizacion' ? 'Priorización' : s.tipo === 'cierre' ? 'Actividades finales' : `Sprint ${s.numero}`;

// Clave única por período para agrupar (carga del equipo por sprint): las
// distintas zonas grises no se mezclan entre sí.
export const clavePeriodo = (s: Pick<Sprint, 'tipo' | 'numero'>) =>
  s.tipo === 'priorizacion'
    ? s.numero === 0
      ? 'Zona Gris (priorización)'
      : 'Zona Gris (priorización final)'
    : s.tipo === 'cierre'
    ? 'Zona Gris (actividades finales)'
    : `Sprint ${s.numero}`;

// Rótulo de la fila de meses para cada columna-día: cada bloque seguido de
// priorización va como "Priorización <mes en que termina>" (ej. 31/08–11/09
// -> "Priorización Septiembre 2026"); el resto, el mes normal.
export function etiquetasMes(columnas: { mesLabel: string; esPriorizacion?: boolean }[]): string[] {
  const etiquetas = columnas.map((c) => c.mesLabel);
  for (let i = 0; i < columnas.length; i++) {
    if (!columnas[i].esPriorizacion || (i > 0 && columnas[i - 1].esPriorizacion)) continue;
    let fin = i;
    while (fin + 1 < columnas.length && columnas[fin + 1].esPriorizacion) fin++;
    for (let k = i; k <= fin; k++) etiquetas[k] = `Priorización ${columnas[fin].mesLabel}`;
  }
  return etiquetas;
}

// Agrupa etiquetas consecutivas iguales (para los encabezados con colSpan).
export function agruparConsecutivas(etiquetas: string[]): { label: string; cantidad: number }[] {
  const grupos: { label: string; cantidad: number }[] = [];
  for (const e of etiquetas) {
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.label === e) ultimo.cantidad++;
    else grupos.push({ label: e, cantidad: 1 });
  }
  return grupos;
}
