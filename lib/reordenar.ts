// lib/reordenar.ts
// Helper de cliente para los botones ▲▼: mueve un elemento dentro de la
// lista de hermanos y guarda el orden completo resultante.

export type TipoReordenable = 'modulo' | 'epica' | 'hu' | 'tarea_matriz' | 'actividad_cierre';

export async function moverElemento(
  tipo: TipoReordenable,
  ids: number[],
  indice: number,
  delta: -1 | 1
): Promise<void> {
  const destino = indice + delta;
  if (destino < 0 || destino >= ids.length) return;
  const nuevos = [...ids];
  [nuevos[indice], nuevos[destino]] = [nuevos[destino], nuevos[indice]];
  const res = await fetch('/api/reordenar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tipo, ids: nuevos }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'No se pudo reordenar');
  }
}
