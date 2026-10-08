// lib/hitos.ts
// Hitos (marca 'cierre', la "H" del Gantt). Significan cosas distintas
// según el Gantt:
//   - Planificado: fecha COMPROMETIDA. No implica que la actividad esté
//     cerrada — nunca se usa para el estado "Cerrada".
//   - Real: hito alcanzado. Es lo único que define si una actividad cerró.
// Las HU tienen un único hito (siempre el último día). Las tareas
// matrices (Análisis y Diseño, Cierre, ...) pueden tener varios, en
// cualquier día: la tarea se considera cerrada cuando su último día
// marcado en el real es un hito.

interface Marca {
  fecha: string;
  tipo_marca: string;
}

export function fechasHito(dias: Marca[]): string[] {
  return dias
    .filter((d) => d.tipo_marca === 'cierre')
    .map((d) => d.fecha.slice(0, 10))
    .sort();
}

// Fecha de cierre efectiva (del Gantt real): el último hito, siempre que
// no haya días de trabajo posteriores. null = todavía abierta.
export function fechaCierreEfectiva(dias: Marca[]): string | null {
  let ultimoHito: string | null = null;
  let ultimoTrabajo: string | null = null;
  for (const d of dias) {
    const f = d.fecha.slice(0, 10);
    if (d.tipo_marca === 'cierre') {
      if (ultimoHito == null || f > ultimoHito) ultimoHito = f;
    } else if (ultimoTrabajo == null || f > ultimoTrabajo) {
      ultimoTrabajo = f;
    }
  }
  if (ultimoHito == null) return null;
  return ultimoTrabajo == null || ultimoHito >= ultimoTrabajo ? ultimoHito : null;
}

export function formatFechaCorta(fecha: string): string {
  return new Date(fecha.slice(0, 10) + 'T00:00:00').toLocaleDateString('es', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

// Hito AUTOMÁTICO de cierre de una funcionalidad (épica) en el planificado:
// el día más lejano marcado entre todas sus actividades (HU), sin importar
// el tipo de marca (desarrollo, certificación, hito o actividad de cierre).
// `marcas`: mapa "hu-id-yyyy-mm-dd" -> tipo_marca de los Gantt. null = sin
// días marcados todavía.
export function hitoCierreFuncionalidad(huIds: number[], marcas: Map<string, string>): string | null {
  const prefijos = huIds.map((id) => `hu-${id}-`);
  let ultima: string | null = null;
  for (const key of marcas.keys()) {
    if (!prefijos.some((p) => key.startsWith(p))) continue;
    const fecha = key.slice(key.length - 10);
    if (ultima == null || fecha > ultima) ultima = fecha;
  }
  return ultima;
}
