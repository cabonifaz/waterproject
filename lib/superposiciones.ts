// lib/superposiciones.ts
// Detecta superposición de talentos: un mismo desarrollador con historias
// de usuario de DISTINTAS funcionalidades marcadas el mismo día. Es solo
// informativo (alerta), no bloquea nada. Reglas:
//   - Solo cuentan las HU "de desarrollo": no las tareas matrices ni las
//     actividades de cierre de la funcionalidad (Certificación, Desarrollo
//     Seguro, Aprobación de Champions...).
//   - Dos HU de la MISMA funcionalidad el mismo día no son superposición
//     (se trabajan juntas).
// Además de "por persona", arma lo necesario para corregirlo desde el
// Gantt: los pares de actividades en conflicto y qué celdas/filas resaltar.

import { Miembro } from '@/types';

export interface FilaConTalentos {
  tipo: string;
  id: number;
  etiqueta: string;
  miembros: Miembro[];
  // "Etapa / Módulo / Épica": si dos actividades se llaman igual (ej.
  // "Certificación" de distintas funcionalidades) se aclara la última parte.
  contexto?: string;
  funcionalidadId?: number; // épica de la HU
  esActividadCierre?: boolean;
}

// ¿Esta actividad entra en el control de superposición?
export const cuentaParaSuperposicion = (f: Pick<FilaConTalentos, 'tipo' | 'esActividadCierre'>) =>
  f.tipo === 'hu' && !f.esActividadCierre;

// Referencia a una actividad del Gantt: `clave` = "tipo-id" (la misma que
// usan las filas), para poder saltar a ella.
export interface ActividadRef {
  clave: string;
  etiqueta: string;
  funcionalidad: string; // para no contar como conflicto dos HU de la misma funcionalidad
}

export interface DiaSuperpuesto {
  fecha: string; // yyyy-mm-dd
  actividades: ActividadRef[];
}

export interface SuperposicionMiembro {
  miembro: Miembro;
  dias: DiaSuperpuesto[];
}

// Dos actividades que comparten persona y día: lo que hay que mover o
// reasignar para resolver la superposición.
export interface ConflictoActividades {
  a: ActividadRef;
  b: ActividadRef;
  miembros: string[]; // iniciales
  fechas: string[]; // yyyy-mm-dd, ordenadas
}

export interface AnalisisSuperposiciones {
  porMiembro: SuperposicionMiembro[];
  conflictos: ConflictoActividades[];
  // "tipo-id-yyyy-mm-dd" -> textos para el tooltip de la celda ("GM también en: ...").
  celdas: Map<string, string[]>;
  // "tipo-id" -> cantidad de días con superposición de esa actividad.
  filas: Map<string, number>;
  totalDias: number; // suma de días superpuestos por persona
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

// `marcas`: mapa "tipo-id-yyyy-mm-dd" -> tipo_marca (el mismo que usan los Gantt).
export function analizarSuperposiciones(filas: FilaConTalentos[], marcas: Map<string, string>): AnalisisSuperposiciones {
  const fechasPorFila = new Map<string, string[]>();
  for (const key of marcas.keys()) {
    const filaKey = key.slice(0, key.length - 11); // quita "-yyyy-mm-dd"
    const lista = fechasPorFila.get(filaKey);
    if (lista) lista.push(key.slice(key.length - 10));
    else fechasPorFila.set(filaKey, [key.slice(key.length - 10)]);
  }

  const etiquetas = etiquetasDistinguibles(filas);

  // miembro -> fecha -> actividades
  const porMiembroMapa = new Map<number, { miembro: Miembro; dias: Map<string, ActividadRef[]> }>();
  for (const fila of filas) {
    if (fila.miembros.length === 0 || !cuentaParaSuperposicion(fila)) continue;
    const clave = `${fila.tipo}-${fila.id}`;
    const fechas = fechasPorFila.get(clave);
    if (!fechas) continue;
    const ref: ActividadRef = {
      clave,
      etiqueta: etiquetas.get(clave) ?? fila.etiqueta,
      // Sin épica conocida, cada actividad es su propio grupo.
      funcionalidad: fila.funcionalidadId != null ? String(fila.funcionalidadId) : clave,
    };
    for (const m of fila.miembros) {
      let entrada = porMiembroMapa.get(m.id);
      if (!entrada) {
        entrada = { miembro: m, dias: new Map() };
        porMiembroMapa.set(m.id, entrada);
      }
      for (const fecha of fechas) {
        const acts = entrada.dias.get(fecha);
        if (acts) acts.push(ref);
        else entrada.dias.set(fecha, [ref]);
      }
    }
  }

  const porMiembro: SuperposicionMiembro[] = [];
  const celdas = new Map<string, string[]>();
  const diasPorFila = new Map<string, Set<string>>();
  const pares = new Map<string, { a: ActividadRef; b: ActividadRef; miembros: Set<string>; fechas: Set<string> }>();

  for (const { miembro, dias } of porMiembroMapa.values()) {
    const superpuestos: DiaSuperpuesto[] = [];
    for (const [fecha, actividades] of dias) {
      // Solo hay conflicto si ese día tiene HU de 2 o más funcionalidades;
      // y cada actividad choca solo con las de OTRAS funcionalidades.
      if (new Set(actividades.map((a) => a.funcionalidad)).size < 2) continue;
      superpuestos.push({ fecha, actividades });
      for (const act of actividades) {
        const otras = actividades.filter((o) => o.funcionalidad !== act.funcionalidad).map((o) => o.etiqueta);
        const celda = `${act.clave}-${fecha}`;
        celdas.set(celda, [...(celdas.get(celda) ?? []), `${miembro.iniciales} también en: ${otras.join(', ')}`]);
        const set = diasPorFila.get(act.clave) ?? new Set<string>();
        set.add(fecha);
        diasPorFila.set(act.clave, set);
      }
      for (let i = 0; i < actividades.length; i++) {
        for (let j = i + 1; j < actividades.length; j++) {
          if (actividades[i].funcionalidad === actividades[j].funcionalidad) continue;
          const [a, b] = [actividades[i], actividades[j]].sort((x, y) => x.clave.localeCompare(y.clave));
          const parKey = `${a.clave}|${b.clave}`;
          const par = pares.get(parKey) ?? { a, b, miembros: new Set<string>(), fechas: new Set<string>() };
          par.miembros.add(miembro.iniciales);
          par.fechas.add(fecha);
          pares.set(parKey, par);
        }
      }
    }
    if (superpuestos.length > 0) {
      superpuestos.sort((x, y) => x.fecha.localeCompare(y.fecha));
      porMiembro.push({ miembro, dias: superpuestos });
    }
  }

  porMiembro.sort((a, b) => b.dias.length - a.dias.length || a.miembro.iniciales.localeCompare(b.miembro.iniciales));
  const conflictos = Array.from(pares.values())
    .map((p) => ({ a: p.a, b: p.b, miembros: Array.from(p.miembros).sort(), fechas: Array.from(p.fechas).sort() }))
    .sort((x, y) => y.fechas.length - x.fechas.length || x.fechas[0].localeCompare(y.fechas[0]));

  return {
    porMiembro,
    conflictos,
    celdas,
    filas: new Map(Array.from(diasPorFila, ([clave, fechas]) => [clave, fechas.size])),
    totalDias: porMiembro.reduce((acc, s) => acc + s.dias.length, 0),
  };
}

export function detectarSuperposiciones(filas: FilaConTalentos[], marcas: Map<string, string>): SuperposicionMiembro[] {
  return analizarSuperposiciones(filas, marcas).porMiembro;
}
