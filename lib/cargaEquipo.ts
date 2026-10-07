// lib/cargaEquipo.ts
// Carga del equipo: para cada persona asignada a actividades (HU / tareas
// matrices), cuántas actividades tiene, cuántos días ocupa, cuándo
// empieza y hasta qué día tiene tareas, su carga día por día y el desglose
// por módulo, por sprint y por proyecto. Sirve para un proyecto o para
// todos los proyectos de un PI: los miembros son por proyecto, así que la
// misma persona en varios proyectos se reconoce por su nombre.

import { EstructuraProyecto, Miembro, Sprint } from '@/types';

export type CampoCarga = 'diasPlanificados' | 'diasReales';

export interface FuenteCarga {
  proyecto: { id: number; nombre: string };
  estructura: EstructuraProyecto;
}

export interface ResumenGrupo {
  actividades: number; // actividades distintas de la persona en el grupo
  dias: number; // días distintos ocupados en el grupo
}

export interface CargaPersona {
  clave: string;
  nombre: string;
  iniciales: string;
  proyectos: string[];
  actividades: number;
  diasOcupados: number; // fechas distintas con al menos una actividad
  diasSuperpuestos: number; // fechas con 2 o más actividades
  primeraFecha: string | null;
  ultimaFecha: string | null; // hasta qué día tiene tareas
  cargaPorFecha: Map<string, string[]>; // fecha -> actividades de ese día
  porModulo: Map<string, ResumenGrupo>;
  porSprint: Map<string, ResumenGrupo>;
  porProyecto: Map<string, ResumenGrupo>;
}

export interface ResultadoCarga {
  personas: CargaPersona[];
  actividadesSinAsignar: number; // con días marcados pero sin talento
  modulos: string[]; // en orden de aparición
  sprints: string[]; // en orden de los sprints
}

const normalizar = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase();

// Un PI puede tener Zona Gris al inicio (numero 0) y al final (numero alto).
const etiquetaSprint = (s: Sprint) =>
  s.tipo === 'priorizacion' ? (s.numero === 0 ? 'Zona Gris' : 'Zona Gris final') : `Sprint ${s.numero}`;

// Para un día dado, a qué sprint pertenece (por rango de fechas).
export function crearBuscadorSprint(sprints: Sprint[]): (fecha: string) => string | null {
  const rangos = sprints.map((s) => ({
    label: etiquetaSprint(s),
    desde: String(s.fecha_inicio).slice(0, 10),
    hasta: String(s.fecha_fin).slice(0, 10),
  }));
  return (fecha) => rangos.find((r) => fecha >= r.desde && fecha <= r.hasta)?.label ?? null;
}

interface Actividad {
  proyecto: string;
  grupo: string; // módulo (HU) o etapa (tareas matrices)
  etiqueta: string;
  miembros: Miembro[];
  fechas: string[];
}

function actividadesDe(fuente: FuenteCarga, campo: CampoCarga): Actividad[] {
  const lista: Actividad[] = [];
  const proyecto = fuente.proyecto.nombre;
  for (const etapa of fuente.estructura.etapas) {
    for (const t of etapa.tareasMatrices) {
      lista.push({
        proyecto,
        grupo: etapa.nombre,
        etiqueta: t.titulo,
        miembros: t.miembros,
        fechas: t[campo].map((d) => String(d.fecha).slice(0, 10)),
      });
    }
    for (const modulo of etapa.modulos) {
      for (const epica of modulo.epicas) {
        for (const h of epica.historias) {
          lista.push({
            proyecto,
            grupo: modulo.nombre,
            // Las actividades de cierre se llaman igual en cada
            // funcionalidad: se aclara de cuál es.
            etiqueta:
              (h.codigo ? `${h.codigo} — ` : '') + h.titulo + (h.es_actividad_cierre ? ` (${epica.nombre})` : ''),
            miembros: h.miembros,
            fechas: h[campo].map((d) => String(d.fecha).slice(0, 10)),
          });
        }
      }
    }
  }
  return lista;
}

export function calcularCargaEquipo(fuentes: FuenteCarga[], sprints: Sprint[], campo: CampoCarga): ResultadoCarga {
  const variosProyectos = fuentes.length > 1;
  const sprintDe = crearBuscadorSprint(sprints);
  // Internamente, por grupo se guardan las actividades y las FECHAS
  // distintas (días ocupados reales, no la suma de días de cada actividad).
  type Acumulado = Map<string, { acts: Set<string>; fechas: Set<string> }>;
  const porPersona = new Map<
    string,
    CargaPersona & { _acts: Set<string>; _modulo: Acumulado; _sprint: Acumulado; _proyecto: Acumulado }
  >();
  const modulos: string[] = [];
  let actividadesSinAsignar = 0;

  for (const fuente of fuentes) {
    for (const act of actividadesDe(fuente, campo)) {
      const grupo = variosProyectos ? `${act.proyecto} · ${act.grupo}` : act.grupo;
      if (!modulos.includes(grupo)) modulos.push(grupo);
      if (act.fechas.length === 0) continue;
      if (act.miembros.length === 0) {
        actividadesSinAsignar++;
        continue;
      }
      const nombreActividad = variosProyectos ? `${act.proyecto}: ${act.etiqueta}` : act.etiqueta;
      const idActividad = `${act.proyecto}|${act.grupo}|${act.etiqueta}`;

      for (const m of act.miembros) {
        const clave = normalizar(m.nombre) || normalizar(m.iniciales);
        let p = porPersona.get(clave);
        if (!p) {
          p = {
            clave,
            nombre: m.nombre,
            iniciales: m.iniciales,
            proyectos: [],
            actividades: 0,
            diasOcupados: 0,
            diasSuperpuestos: 0,
            primeraFecha: null,
            ultimaFecha: null,
            cargaPorFecha: new Map(),
            porModulo: new Map(),
            porSprint: new Map(),
            porProyecto: new Map(),
            _acts: new Set(),
            _modulo: new Map(),
            _sprint: new Map(),
            _proyecto: new Map(),
          };
          porPersona.set(clave, p);
        }
        if (!p.proyectos.includes(act.proyecto)) p.proyectos.push(act.proyecto);
        p._acts.add(idActividad);

        const sumar = (acc: Acumulado, key: string, fecha: string) => {
          let r = acc.get(key);
          if (!r) {
            r = { acts: new Set(), fechas: new Set() };
            acc.set(key, r);
          }
          r.acts.add(idActividad);
          r.fechas.add(fecha);
        };
        for (const f of act.fechas) {
          sumar(p._modulo, grupo, f);
          sumar(p._proyecto, act.proyecto, f);
          sumar(p._sprint, sprintDe(f) ?? 'Fuera de sprint', f);
          const delDia = p.cargaPorFecha.get(f);
          if (delDia) delDia.push(nombreActividad);
          else p.cargaPorFecha.set(f, [nombreActividad]);
        }
      }
    }
  }

  const resumir = (acc: Acumulado) =>
    new Map(Array.from(acc.entries()).map(([k, v]) => [k, { actividades: v.acts.size, dias: v.fechas.size }]));

  const personas = Array.from(porPersona.values()).map(({ _acts, _modulo, _sprint, _proyecto, ...p }) => {
    const fechas = Array.from(p.cargaPorFecha.keys()).sort();
    return {
      ...p,
      porModulo: resumir(_modulo),
      porSprint: resumir(_sprint),
      porProyecto: resumir(_proyecto),
      actividades: _acts.size,
      diasOcupados: fechas.length,
      diasSuperpuestos: fechas.filter((f) => (p.cargaPorFecha.get(f)?.length ?? 0) > 1).length,
      primeraFecha: fechas[0] ?? null,
      ultimaFecha: fechas[fechas.length - 1] ?? null,
    };
  });
  personas.sort((a, b) => a.nombre.localeCompare(b.nombre));

  return {
    personas,
    actividadesSinAsignar,
    modulos,
    sprints: Array.from(new Set([...sprints.map(etiquetaSprint), 'Fuera de sprint'])),
  };
}
