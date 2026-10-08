// lib/ganttFiltro.ts
// Filtra las filas de un Gantt manteniendo su jerarquía: los divisores
// (etapa/módulo/épica) solo se muestran si les queda al menos una fila
// visible después del filtro — van "pendientes" hasta que aparece la
// primera fila que coincide.

type NivelDivisor = 'etapa' | 'modulo' | 'epica';
type ItemGantt = { kind: 'divisor'; nivel: NivelDivisor } | { kind: 'fila' };

export function filtrarConDivisores<T extends ItemGantt>(
  items: T[],
  coincide: (fila: Extract<T, { kind: 'fila' }>) => boolean
): T[] {
  const resultado: T[] = [];
  let pendientes: T[] = [];
  const nivel = (item: T) => (item as Extract<T, { kind: 'divisor' }>).nivel;
  for (const item of items) {
    if (item.kind === 'divisor') {
      const n = nivel(item);
      if (n === 'etapa') pendientes = [item];
      else if (n === 'modulo') pendientes = [...pendientes.filter((p) => nivel(p) === 'etapa'), item];
      else pendientes = [...pendientes.filter((p) => nivel(p) !== 'epica'), item];
      continue;
    }
    if (coincide(item as Extract<T, { kind: 'fila' }>)) {
      resultado.push(...pendientes, item);
      pendientes = [];
    }
  }
  return resultado;
}
