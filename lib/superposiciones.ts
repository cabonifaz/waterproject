// lib/superposiciones.ts
// Detecta superposición de talentos: una misma persona asignada a dos o
// más actividades que tienen marca (desarrollo/trabajo, certificación o
// hito) el mismo día. Es solo informativo (alerta), no bloquea nada.

import { Miembro } from '@/types';

export interface FilaConTalentos {
  tipo: string;
  id: number;
  etiqueta: string;
  miembros: Miembro[];
  // "Etapa / Módulo / Épica": si dos actividades se llaman igual (ej.
  // "Certificación" de distintas funcionalidades) se aclara la última parte.
  contexto?: string;
}

function etiquetasDistinguibles(filas: FilaConTalentos[]): Map<string, string> {
  const usos = new Map<string, number>();
  for (const f of filas) usos.set(f.etiqueta, (usos.get(f.etiqueta) ?? 0) + 1);
  const resultado = new Map<string, string>();
  for (const f of filas) {
    const grupo = f.contexto?.split(' / ').pop();
    resultado.set(`${f.tipo}-${f.id}`, (usos.get(f.etiqueta) ?? 0) > 1 && grupo ? `${f.etiqueta} (${grupo})` : f.etiqueta);
  }
  return resultado;
}

export interface DiaSuperpuesto {
  fecha: string; // yyyy-mm-dd
  actividades: string[];
}

export interface SuperposicionMiembro {
  miembro: Miembro;
  dias: DiaSuperpuesto[];
}

// `marcas`: mapa "tipo-id-yyyy-mm-dd" -> tipo_marca (el mismo que usan los Gantt).
export function detectarSuperposiciones(filas: FilaConTalentos[], marcas: Map<string, string>): SuperposicionMiembro[] {
  const fechasPorFila = new Map<string, string[]>();
  for (const key of marcas.keys()) {
    const filaKey = key.slice(0, key.length - 11); // quita "-yyyy-mm-dd"
    const lista = fechasPorFila.get(filaKey);
    if (lista) lista.push(key.slice(key.length - 10));
    else fechasPorFila.set(filaKey, [key.slice(key.length - 10)]);
  }

  const etiquetas = etiquetasDistinguibles(filas);

  // miembro -> fecha -> actividades
  const porMiembro = new Map<number, { miembro: Miembro; dias: Map<string, string[]> }>();
  for (const fila of filas) {
    const etiqueta = etiquetas.get(`${fila.tipo}-${fila.id}`) ?? fila.etiqueta;
    if (fila.miembros.length === 0) continue;
    const fechas = fechasPorFila.get(`${fila.tipo}-${fila.id}`);
    if (!fechas) continue;
    for (const m of fila.miembros) {
      let entrada = porMiembro.get(m.id);
      if (!entrada) {
        entrada = { miembro: m, dias: new Map() };
        porMiembro.set(m.id, entrada);
      }
      for (const fecha of fechas) {
        const acts = entrada.dias.get(fecha);
        if (acts) acts.push(etiqueta);
        else entrada.dias.set(fecha, [etiqueta]);
      }
    }
  }

  const resultado: SuperposicionMiembro[] = [];
  for (const { miembro, dias } of porMiembro.values()) {
    const superpuestos = Array.from(dias.entries())
      .filter(([, acts]) => acts.length > 1)
      .map(([fecha, actividades]) => ({ fecha, actividades }))
      .sort((a, b) => a.fecha.localeCompare(b.fecha));
    if (superpuestos.length > 0) resultado.push({ miembro, dias: superpuestos });
  }
  return resultado.sort((a, b) => b.dias.length - a.dias.length || a.miembro.iniciales.localeCompare(b.miembro.iniciales));
}
