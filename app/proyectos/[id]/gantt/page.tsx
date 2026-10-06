// app/proyectos/[id]/gantt/page.tsx
// Vista Gantt planificada: columnas = días hábiles agrupados por sprint,
// filas = tareas matrices y HU. Click en una celda marca/despeja el día
// según el modo activo (desarrollo|trabajo / certificación / hito).
// El "H" del planificado es la FECHA COMPROMETIDA — no significa que la
// actividad esté cerrada (eso solo lo dice el hito del Gantt Real). Las
// HU tienen un único hito; las tareas matrices pueden tener varios.
// Misma distribución de celdas (anchos, altos y bordes) que el Gantt
// Real: ver app/proyectos/[id]/gantt-real/page.tsx.

'use client';

import { Fragment, useCallback, useEffect, useMemo, useRef, useState, CSSProperties } from 'react';
import { useParams } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import SelectorMiembros from '@/components/SelectorMiembros';
import Modal from '@/components/Modal';
import FormularioImportarGanttExcel from '@/components/FormularioImportarGanttExcel';
import FormularioImportarPlanExterno from '@/components/FormularioImportarPlanExterno';
import EditarSprintsModal from '@/components/EditarSprintsModal';
import { EstructuraProyecto, Sprint, Feriado, Miembro } from '@/types';
import {
  calcularTotalesPlanificados,
  calcularPorcentaje,
  diasPlanificadosEpica,
  contarDias,
  totalDias,
  TOTALES_VACIOS,
} from '@/lib/planificacion';
import { formatFechaCorta } from '@/lib/hitos';
import { exportarGanttComoExcel, ItemExcel } from '@/lib/exportarGanttExcel';

type Modo = 'desarrollo' | 'certificacion' | 'cierre';

interface FilaGantt {
  tipo: 'tareaMatriz' | 'hu';
  id: number;
  etiqueta: string;
  contexto: string;
  marcasPermitidas: string[];
  esActividadCierre?: boolean; // HU de cierre obligatoria de la funcionalidad
  miembros: Miembro[];
  diasPropios?: number; // solo tareas matrices: días de "trabajo" marcados, para el "(N días · %)" del título
}

type NivelDivisor = 'etapa' | 'modulo' | 'epica';

type ItemRender =
  | { kind: 'divisor'; nivel: NivelDivisor; label: string; key: string; diasGrupo?: number }
  | { kind: 'fila'; fila: FilaGantt };

const ANCHO_ACTIVIDAD = 260;
const ANCHO_H = 36;
const ANCHO_MIEMBROS = 96;
const ANCHO_PANEL_FIJO = ANCHO_H + ANCHO_ACTIVIDAD + ANCHO_MIEMBROS;
const ALTO_FILA_MES = 26;
const ALTO_FILA_SPRINT = 26;
const ALTO_FILA_DIA = 32;
const ALTO_ENCABEZADO = ALTO_FILA_MES + ALTO_FILA_SPRINT + ALTO_FILA_DIA;
const ALTO_FILA_DATO = 56;
const ALTO_FILA_DIVISOR = 28;

// Fuerza que cada celda "sticky" tenga su propia capa de composición —
// ayuda a que el navegador la repinte de forma más estable durante el
// scroll.
const CAPA_FIJA: CSSProperties = { transform: 'translateZ(0)', backfaceVisibility: 'hidden' };

interface Columna {
  fecha: string; // yyyy-mm-dd
  grupoLabel: string;
  mesLabel: string;
  diaMes: number;
  diaSemana: string;
  esFeriado: boolean;
  esInicioGrupo: boolean;
  esHoy: boolean;
}

const DIAS_SEMANA = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

function soloFecha(iso: string | Date): Date {
  const s = typeof iso === 'string' ? iso : iso.toISOString();
  const [y, m, d] = s.slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function formatISO(fecha: Date): string {
  return fecha.toISOString().split('T')[0];
}

function etiquetaGrupo(sprint: Sprint): string {
  // Períodos de priorización (al inicio y, opcionalmente, al final del PI):
  // "Zona Gris", como en el cronograma de referencia del usuario.
  return sprint.tipo === 'priorizacion' ? 'Zona Gris' : `Sprint ${sprint.numero}`;
}

// Los feriados NO se excluyen (a diferencia de los fines de semana): se
// muestran como columna normal pero marcada, para que se vea resaltada en
// todas las filas del Gantt (ver `esFeriado` al renderizar).
function calcularColumnas(sprints: Sprint[], feriados: Set<string>): Columna[] {
  const hoyISO = formatISO(soloFecha(new Date()));
  const columnas: Columna[] = [];
  for (const sprint of sprints) {
    const inicio = soloFecha(sprint.fecha_inicio);
    const fin = soloFecha(sprint.fecha_fin);
    const cursor = new Date(inicio);
    let esPrimerDiaDelSprint = true;
    while (cursor <= fin) {
      const dow = cursor.getUTCDay();
      const fecha = formatISO(cursor);
      if (dow !== 0 && dow !== 6) {
        columnas.push({
          fecha,
          grupoLabel: etiquetaGrupo(sprint),
          mesLabel: `${MESES[cursor.getUTCMonth()]} ${cursor.getUTCFullYear()}`,
          diaMes: cursor.getUTCDate(),
          diaSemana: DIAS_SEMANA[dow],
          esFeriado: feriados.has(fecha),
          esInicioGrupo: esPrimerDiaDelSprint,
          esHoy: fecha === hoyISO,
        });
        esPrimerDiaDelSprint = false;
      }
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  }
  return columnas;
}

// Intercala filas-divisor (etapa/módulo/épica) para que se vea la
// jerarquía en el Gantt: una barra completa que corta todos los días de
// todos los sprints, con el nombre en la columna de Actividad. Cada épica
// lleva su total de días planificados (desarrollo + certificación + hitos de sus
// HU) y cada tarea matriz el conteo de días de "trabajo" — ambos usados
// después para el "(N días · %)" junto al nombre.
function construirItemsRender(estructura: EstructuraProyecto): ItemRender[] {
  const items: ItemRender[] = [];
  for (const etapa of estructura.etapas) {
    items.push({ kind: 'divisor', nivel: 'etapa', label: etapa.nombre, key: `etapa-${etapa.id}` });

    for (const t of etapa.tareasMatrices) {
      items.push({
        kind: 'fila',
        fila: {
          tipo: 'tareaMatriz',
          id: t.id,
          etiqueta: t.titulo,
          contexto: etapa.nombre,
          marcasPermitidas: ['trabajo', 'cierre'],
          miembros: t.miembros,
          diasPropios: contarDias(t.diasPlanificados), // incluye los días de hito
        },
      });
    }

    for (const modulo of etapa.modulos) {
      items.push({ kind: 'divisor', nivel: 'modulo', label: modulo.nombre, key: `modulo-${modulo.id}` });

      for (const epica of modulo.epicas) {
        items.push({
          kind: 'divisor',
          nivel: 'epica',
          label: epica.nombre,
          key: `epica-${epica.id}`,
          diasGrupo: diasPlanificadosEpica(epica),
        });

        for (const h of epica.historias) {
          items.push({
            kind: 'fila',
            fila: {
              tipo: 'hu',
              id: h.id,
              etiqueta: (h.codigo ? `${h.codigo} — ` : '') + h.titulo,
              contexto: `${etapa.nombre} / ${modulo.nombre} / ${epica.nombre}`,
              marcasPermitidas: ['desarrollo', 'certificacion', 'cierre'],
              esActividadCierre: !!h.es_actividad_cierre,
              miembros: h.miembros,
            },
          });
        }
      }
    }
  }
  return items;
}

function claveMarca(tipo: string, id: number, fecha: string): string {
  return `${tipo}-${id}-${fecha}`;
}

function tipoEfectivoDe(fila: FilaGantt, modo: Modo): string {
  return modo === 'desarrollo' && fila.tipo === 'tareaMatriz' ? 'trabajo' : modo;
}

// Misma paleta que EtapaSeccion/ModuloSeccion/EpicaSeccion en la página de
// estructura, para que ambas vistas se lean como el mismo árbol.
const ESTILOS_DIVISOR: Record<NivelDivisor, { fila: string; celda: string; padding: string }> = {
  etapa: { fila: 'bg-blue-950 text-white', celda: 'bg-blue-950', padding: 'pl-2' },
  modulo: { fila: 'bg-indigo-200 text-indigo-900', celda: 'bg-indigo-200', padding: 'pl-5' },
  epica: { fila: 'bg-blue-100 text-blue-900', celda: 'bg-blue-100', padding: 'pl-8' },
};

const coloresMarca: Record<string, string> = {
  desarrollo: 'bg-green-500',
  trabajo: 'bg-green-500',
  certificacion: 'bg-orange-400',
  cierre: 'bg-blue-600',
};

const MODOS: { valor: Modo; label: string; color: string }[] = [
  { valor: 'desarrollo', label: '🟢 Desarrollo / Trabajo', color: 'bg-green-500' },
  { valor: 'certificacion', label: '🟠 Certificación', color: 'bg-orange-400' },
  { valor: 'cierre', label: '🔵 Hito (fecha comprometida)', color: 'bg-blue-600' },
];

export default function GanttPage() {
  const params = useParams();
  const proyectoId = parseInt(params.id as string, 10);

  const [estructura, setEstructura] = useState<EstructuraProyecto | null>(null);
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [feriados, setFeriados] = useState<Feriado[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modo, setModo] = useState<Modo>('desarrollo');
  const [marcas, setMarcas] = useState<Map<string, string>>(new Map());
  const [sidebarAbierto, setSidebarAbierto] = useState(true);
  const [cambiandoEstado, setCambiandoEstado] = useState(false);
  const [exportando, setExportando] = useState(false);
  const [mostrarImportar, setMostrarImportar] = useState(false);
  const [mostrarImportarPlanExterno, setMostrarImportarPlanExterno] = useState(false);
  const [mostrarSprints, setMostrarSprints] = useState(false);
  const [modalTituloCompleto, setModalTituloCompleto] = useState<string | null>(null);
  const [controlesAbiertos, setControlesAbiertos] = useState(true);

  // Panel fijo (H/Actividad/Miembros) como overlay absoluto sincronizado a
  // mano con el scroll vertical — mismo patrón que el Gantt Real (sticky
  // se desalinea/parpadea con muchas filas x columnas).
  const scrollRef = useRef<HTMLDivElement>(null);
  const panelFijoBodyRef = useRef<HTMLDivElement>(null);
  const handleScrollGantt = useCallback(() => {
    if (scrollRef.current && panelFijoBodyRef.current) {
      panelFijoBodyRef.current.style.transform = `translateY(-${scrollRef.current.scrollTop}px)`;
    }
  }, []);

  const cargar = useCallback(async () => {
    try {
      setLoading(true);
      const [res, resSprints, resFeriados] = await Promise.all([
        fetch(`/api/proyectos/${proyectoId}/estructura`),
        fetch(`/api/proyectos/${proyectoId}/sprints`),
        fetch('/api/feriados'),
      ]);
      if (!res.ok) throw new Error('Error al obtener la estructura del proyecto');
      if (!resSprints.ok || !resFeriados.ok) throw new Error('Error al obtener sprints o feriados');
      const data = await res.json();
      const dataSprints = await resSprints.json();
      const dataFeriados = await resFeriados.json();
      setEstructura(data.data);
      setSprints(dataSprints.data || []);
      setFeriados(dataFeriados.data || []);

      // OJO: el backend devuelve la fecha como ISO datetime completo
      // (ej. "2026-08-04T05:00:00.000Z"); las celdas de la grilla usan
      // solo "yyyy-mm-dd" (ver `columnas`/`claveMarca` en el click) — hay
      // que recortar acá o las claves nunca calzan y lo marcado no se ve
      // reflejado al recargar, aunque sí haya quedado guardado.
      const m = new Map<string, string>();
      for (const etapa of data.data.etapas) {
        for (const t of etapa.tareasMatrices) {
          for (const d of t.diasPlanificados) {
            m.set(claveMarca('tareaMatriz', t.id, d.fecha.slice(0, 10)), d.tipo_marca);
          }
        }
        for (const modulo of etapa.modulos) {
          for (const epica of modulo.epicas) {
            for (const h of epica.historias) {
              for (const d of h.diasPlanificados) {
                m.set(claveMarca('hu', h.id, d.fecha.slice(0, 10)), d.tipo_marca);
              }
            }
          }
        }
      }
      setMarcas(m);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  }, [proyectoId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const feriadosSet = useMemo(() => new Set(feriados.map((f) => String(f.fecha).slice(0, 10))), [feriados]);
  const columnas = useMemo(() => calcularColumnas(sprints, feriadosSet), [sprints, feriadosSet]);
  const itemsRender = useMemo(() => (estructura ? construirItemsRender(estructura) : []), [estructura]);
  const cantidadFilas = useMemo(() => itemsRender.filter((i) => i.kind === 'fila').length, [itemsRender]);
  // Hitos por fila calculados en vivo desde `marcas` (no desde
  // `estructura`), para que el H del panel fijo se actualice apenas se
  // marca una celda, sin recargar.
  const hitosPorFila = useMemo(() => {
    const mapa = new Map<string, string[]>();
    for (const [key, valor] of marcas) {
      if (valor !== 'cierre') continue;
      const filaKey = key.slice(0, key.length - 11); // quita "-yyyy-mm-dd"
      mapa.set(filaKey, [...(mapa.get(filaKey) ?? []), key.slice(key.length - 10)].sort());
    }
    return mapa;
  }, [marcas]);
  const totales = useMemo(
    () => (estructura ? calcularTotalesPlanificados(estructura) : TOTALES_VACIOS),
    [estructura]
  );
  const totalGeneral = totalDias(totales);
  const planificadoAbierto = estructura?.proyecto.estado_planificacion !== 'cerrado';

  const gruposSprint = useMemo(() => {
    const grupos: { label: string; cantidad: number }[] = [];
    for (const c of columnas) {
      const ultimo = grupos[grupos.length - 1];
      if (ultimo && ultimo.label === c.grupoLabel) ultimo.cantidad++;
      else grupos.push({ label: c.grupoLabel, cantidad: 1 });
    }
    return grupos;
  }, [columnas]);

  const gruposMes = useMemo(() => {
    const grupos: { label: string; cantidad: number }[] = [];
    for (const c of columnas) {
      const ultimo = grupos[grupos.length - 1];
      if (ultimo && ultimo.label === c.mesLabel) ultimo.cantidad++;
      else grupos.push({ label: c.mesLabel, cantidad: 1 });
    }
    return grupos;
  }, [columnas]);

  // Un mismo día puede ser a la vez inicio de sprint e inicio de mes — acá
  // se resuelve la jerarquía visual: mes (más grueso) > sprint > día común,
  // aplicada de forma continua desde el encabezado hasta cada fila.
  const esInicioMes = useMemo(
    () => columnas.map((c, i) => i === 0 || c.mesLabel !== columnas[i - 1].mesLabel),
    [columnas]
  );
  const bordeGrupoDia = (i: number) =>
    esInicioMes[i] ? 'border-l-4 border-l-slate-900' : columnas[i].esInicioGrupo ? 'border-l-2 border-l-slate-500' : '';

  const handleClickCelda = (fila: FilaGantt, fecha: string) => {
    if (!planificadoAbierto) return;
    const tipoEfectivo = tipoEfectivoDe(fila, modo);
    if (!fila.marcasPermitidas.includes(tipoEfectivo)) return;

    const key = claveMarca(fila.tipo, fila.id, fecha);

    setMarcas((prev) => {
      const next = new Map(prev);
      // HU: hito único (marcar uno nuevo mueve el anterior). Las tareas
      // matrices admiten varios hitos.
      if (tipoEfectivo === 'cierre' && fila.tipo === 'hu') {
        for (const k of Array.from(next.keys())) {
          if (k.startsWith(`${fila.tipo}-${fila.id}-`) && next.get(k) === 'cierre') next.delete(k);
        }
      }
      if (next.get(key) === tipoEfectivo) {
        next.delete(key);
      } else {
        next.set(key, tipoEfectivo);
      }
      return next;
    });

    const endpoint =
      fila.tipo === 'hu' ? `/api/historias-usuario/${fila.id}/dias` : `/api/tareas-matrices/${fila.id}/dias`;

    fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fecha, tipo_marca: tipoEfectivo }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || `Error al guardar (${res.status})`);
        }
        setError(null);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'No se pudo guardar la marca');
        // la petición falló: recargar lo guardado para no mentirle a la UI
        cargarSilencioso();
      });
  };

  // Igual que `cargar` pero sin el skeleton de carga (no "parpadea" el Gantt).
  const cargarSilencioso = async () => {
    try {
      const res = await fetch(`/api/proyectos/${proyectoId}/estructura`);
      if (!res.ok) return;
      const data = await res.json();
      setEstructura(data.data);
      const m = new Map<string, string>();
      for (const etapa of data.data.etapas) {
        for (const t of etapa.tareasMatrices)
          for (const d of t.diasPlanificados) m.set(claveMarca('tareaMatriz', t.id, d.fecha.slice(0, 10)), d.tipo_marca);
        for (const modulo of etapa.modulos)
          for (const epica of modulo.epicas)
            for (const h of epica.historias)
              for (const d of h.diasPlanificados) m.set(claveMarca('hu', h.id, d.fecha.slice(0, 10)), d.tipo_marca);
      }
      setMarcas(m);
    } catch {
      // no bloquea el Gantt
    }
  };

  const handleCerrarPlanificado = async () => {
    setCambiandoEstado(true);
    try {
      const res = await fetch(`/api/proyectos/${proyectoId}/cerrar-planificado`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al cerrar el planificado');
      await cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cerrar el planificado');
    } finally {
      setCambiandoEstado(false);
    }
  };

  const handleReactivarPlanificado = async () => {
    setCambiandoEstado(true);
    try {
      const res = await fetch(`/api/proyectos/${proyectoId}/reactivar-planificado`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al reactivar el planificado');
      await cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al reactivar el planificado');
    } finally {
      setCambiandoEstado(false);
    }
  };

  const handleExportarExcel = async () => {
    setExportando(true);
    try {
      const sufijo = (dias: number) => {
        const pct = calcularPorcentaje(dias, totalGeneral);
        return ` (${dias} día${dias === 1 ? '' : 's'}${pct != null ? ` · ${pct}%` : ''})`;
      };

      const items: ItemExcel[] = itemsRender.map((item) =>
        item.kind === 'divisor'
          ? { kind: 'divisor', nivel: item.nivel, label: item.label + (item.diasGrupo != null ? sufijo(item.diasGrupo) : '') }
          : {
              kind: 'fila',
              tipo: item.fila.tipo,
              id: item.fila.id,
              etiqueta: item.fila.etiqueta, // los días van en su propia columna (fórmula)
              contexto: item.fila.contexto,
              fechaCierre: (hitosPorFila.get(`${item.fila.tipo}-${item.fila.id}`) ?? []).slice(-1)[0],
              miembros: item.fila.miembros.map((m) => m.iniciales).join('/'),
              esActividadCierre: item.fila.esActividadCierre,
            }
      );

      const nombre = `Gantt-Planificado-${estructura?.proyecto.nombre || proyectoId}`.replace(/[^\w-]+/g, '_');
      await exportarGanttComoExcel({
        nombreArchivo: nombre,
        nombreHoja: 'Gantt Planificado',
        columnas,
        items,
        marcas,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo exportar el Excel');
    } finally {
      setExportando(false);
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {sidebarAbierto && <Sidebar />}

      <main className="flex-1 overflow-hidden flex flex-col">
        <div className="p-6 pb-0 flex-shrink-0">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSidebarAbierto((v) => !v)}
                title={sidebarAbierto ? 'Ocultar menú' : 'Mostrar menú'}
                className="w-9 h-9 flex items-center justify-center rounded-lg border border-gray-200 bg-white hover:bg-gray-100 text-gray-600 flex-shrink-0"
              >
                {sidebarAbierto ? '⟨' : '☰'}
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">📊 Gantt Planificado</h1>
                {estructura && <p className="text-gray-600 text-sm mt-1">{estructura.proyecto.nombre}</p>}
              </div>
            </div>
            {controlesAbiertos && (
              <div className="flex items-center gap-3 flex-wrap">
                <a
                  href={`/proyectos/${proyectoId}/gantt-real`}
                  className="px-4 py-2 rounded-lg text-sm font-semibold bg-white border-2 border-slate-300 text-slate-700 hover:bg-slate-50"
                >
                  🎯 REAL
                </a>
                {estructura?.proyecto.pi_id && (
                  <button
                    onClick={() => setMostrarSprints(true)}
                    title="Editar las fechas de los sprints o ampliar el planificado"
                    className="px-4 py-2 rounded-lg text-sm font-semibold bg-white border-2 border-slate-300 text-slate-700 hover:bg-slate-50"
                  >
                    🗓️ Sprints
                  </button>
                )}
                {estructura && (
                  <button
                    onClick={planificadoAbierto ? handleCerrarPlanificado : handleReactivarPlanificado}
                    disabled={cambiandoEstado}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 ${
                      planificadoAbierto
                        ? 'bg-white border-2 border-slate-300 text-slate-700 hover:bg-slate-50'
                        : 'bg-amber-500 text-white hover:bg-amber-600'
                    }`}
                  >
                    {cambiandoEstado
                      ? '⏳ Procesando...'
                      : planificadoAbierto
                      ? '🔒 Cerrar Planificado'
                      : '🔓 Reactivar (Control de Cambios)'}
                  </button>
                )}
                {estructura && columnas.length > 0 && (
                  <button
                    onClick={handleExportarExcel}
                    disabled={exportando}
                    className="px-4 py-2 rounded-lg text-sm font-semibold bg-white border-2 border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    {exportando ? '⏳ Exportando...' : '📊 Exportar Excel'}
                  </button>
                )}
                {estructura && columnas.length > 0 && planificadoAbierto && (
                  <button
                    onClick={() => setMostrarImportar(true)}
                    className="px-4 py-2 rounded-lg text-sm font-semibold bg-white border-2 border-slate-300 text-slate-700 hover:bg-slate-50"
                  >
                    📥 Importar Excel
                  </button>
                )}
                {estructura && columnas.length > 0 && planificadoAbierto && (
                  <button
                    onClick={() => setMostrarImportarPlanExterno(true)}
                    className="px-4 py-2 rounded-lg text-sm font-semibold bg-white border-2 border-slate-300 text-slate-700 hover:bg-slate-50"
                  >
                    📋 Importar Plan de Trabajo
                  </button>
                )}
                <a href={`/proyectos/${proyectoId}`} className="text-sm text-blue-600 hover:text-blue-800 font-semibold">
                  ← Volver a la estructura
                </a>
              </div>
            )}
          </div>

          {!planificadoAbierto && (
            <div className="mb-4 bg-amber-50 border border-amber-300 text-amber-800 px-4 py-2 rounded-lg text-sm font-medium">
              🔒 El planificado está cerrado — es de solo lectura. Tocá &quot;Reactivar (Control de Cambios)&quot; para
              volver a marcar días; el planificado inicial queda guardado igual.
            </div>
          )}

          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm">
              {error}
            </div>
          )}

          {loading && !estructura && <div className="animate-pulse h-32 bg-gray-200 rounded mb-4" />}

          {!loading && estructura && columnas.length === 0 && (
            <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500 mb-4">
              Este PI todavía no tiene sprints generados.{' '}
              <a
                href={estructura.proyecto.pi_id ? `/pis/${estructura.proyecto.pi_id}` : '/pis'}
                className="text-blue-600 hover:text-blue-800 font-semibold"
              >
                Generalos primero en el PI
              </a>
              .
            </div>
          )}
        </div>

        {estructura && columnas.length > 0 && (
          <div className="flex-1 min-h-0 flex flex-col px-6 pb-6">
            {controlesAbiertos && (
              <div className="flex items-center gap-6 mb-3 bg-white rounded-lg shadow px-4 py-2 text-sm flex-shrink-0 flex-wrap">
                <span className="font-semibold text-gray-700">📊 Días planificados:</span>
                <span className="flex items-center gap-1.5 text-gray-600">
                  <span className="w-3 h-3 rounded bg-green-500 inline-block" /> Desarrollo:{' '}
                  <strong className="text-gray-900">{totales.desarrollo}</strong>
                </span>
                <span className="flex items-center gap-1.5 text-gray-600">
                  <span className="w-3 h-3 rounded bg-orange-400 inline-block" /> Certificación:{' '}
                  <strong className="text-gray-900">{totales.certificacion}</strong>
                </span>
                <span className="flex items-center gap-1.5 text-gray-600">
                  <span className="w-3 h-3 rounded bg-blue-600 inline-block" /> Hitos:{' '}
                  <strong className="text-gray-900">{totales.hitos}</strong>
                </span>
                <span className="text-gray-600">
                  Total: <strong className="text-gray-900">{totalGeneral}</strong> día(s)
                </span>
              </div>
            )}

            <div className="flex justify-between items-center gap-4 mb-4 bg-white rounded-lg shadow p-3 flex-shrink-0 flex-wrap">
              <div className="flex gap-2 items-center flex-wrap">
                <span className="text-sm text-gray-500 mr-1">Marcando:</span>
                {MODOS.map((m) => (
                  <button
                    key={m.valor}
                    onClick={() => setModo(m.valor)}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold border-2 transition-colors ${
                      modo === m.valor ? `${m.color} text-white border-transparent` : 'border-gray-200 text-gray-600'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-3">
                {controlesAbiertos && (
                  <div className="flex items-center gap-4 text-xs text-gray-500 flex-wrap">
                    <span
                      className="flex items-center gap-1"
                      title="En el planificado, H = fecha comprometida. El cierre real se marca en el Gantt Real."
                    >
                      <span className="w-3 h-3 rounded bg-blue-600 inline-block" /> H = fecha comprometida
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-3 h-3 rounded bg-orange-200 inline-block" /> Feriado
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-1 h-3 rounded bg-slate-400 inline-block" /> Inicio de sprint
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-1.5 h-3 rounded bg-purple-600 inline-block" /> Hoy
                    </span>
                    <span>
                      {columnas.length} día(s) · {cantidadFilas} actividad(es)
                    </span>
                  </div>
                )}
                <button
                  onClick={() => setControlesAbiertos((v) => !v)}
                  title={
                    controlesAbiertos
                      ? 'Ocultar botones, resumen y leyenda (más espacio para el Gantt)'
                      : 'Mostrar botones, resumen y leyenda'
                  }
                  className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 bg-white hover:bg-gray-100 text-gray-500 flex-shrink-0"
                >
                  {controlesAbiertos ? '▴' : '▾'}
                </button>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow flex-1 min-h-0 relative overflow-hidden">
              <div ref={scrollRef} onScroll={handleScrollGantt} className="overflow-auto h-full text-xs">
                <div
                  className="grid"
                  style={{ gridTemplateColumns: `repeat(${columnas.length}, 44px)`, paddingLeft: ANCHO_PANEL_FIJO }}
                >
                  {(() => {
                    let col = 1;
                    return gruposMes.map((g, i) => {
                      const inicio = col;
                      col += g.cantidad;
                      return (
                        <div
                          key={`${g.label}-${i}`}
                          style={{ ...CAPA_FIJA, top: 0, height: ALTO_FILA_MES, gridColumn: `${inicio} / ${inicio + g.cantidad}`, gridRow: 1 }}
                          className="sticky z-20 border-y border-r border-l-4 border-l-slate-900 px-1 py-1 flex items-center justify-center font-semibold bg-green-100 text-green-900"
                        >
                          {g.label}
                        </div>
                      );
                    });
                  })()}
                  {(() => {
                    let col = 1;
                    return gruposSprint.map((g, i) => {
                      const inicio = col;
                      col += g.cantidad;
                      return (
                        <div
                          key={`${g.label}-${i}`}
                          style={{ ...CAPA_FIJA, top: ALTO_FILA_MES, height: ALTO_FILA_SPRINT, gridColumn: `${inicio} / ${inicio + g.cantidad}`, gridRow: 2 }}
                          className="sticky z-20 border-y border-r border-l-2 border-l-slate-500 px-1 py-1 flex items-center justify-center font-semibold bg-green-100 text-green-900"
                        >
                          {g.label}
                        </div>
                      );
                    });
                  })()}
                  {columnas.map((c, i) => (
                    <div
                      key={c.fecha}
                      title={c.esHoy ? `${c.fecha} — HOY` : c.fecha}
                      style={{ ...CAPA_FIJA, top: ALTO_FILA_MES + ALTO_FILA_SPRINT, height: ALTO_FILA_DIA, gridColumn: 1 + i, gridRow: 3 }}
                      className={`sticky z-20 border flex items-center justify-center text-[11px] font-semibold tabular-nums ${bordeGrupoDia(i)} ${
                        c.esHoy
                          ? 'border-purple-700 bg-purple-600 text-white'
                          : c.esFeriado
                          ? 'border-slate-300 bg-orange-200 text-orange-800'
                          : 'border-slate-300 bg-slate-50 text-gray-700'
                      }`}
                    >
                      {c.esHoy ? 'HOY' : `${c.diaSemana}${String(c.diaMes).padStart(2, '0')}`}
                    </div>
                  ))}

                  {itemsRender.map((item, filaIdx) => {
                    const filaGrid = 4 + filaIdx;
                    if (item.kind === 'divisor') {
                      const estilo = ESTILOS_DIVISOR[item.nivel];
                      return (
                        <div
                          key={item.key}
                          style={{ gridColumn: '1 / -1', gridRow: filaGrid, height: ALTO_FILA_DIVISOR }}
                          className={`border ${estilo.celda}`}
                        />
                      );
                    }

                    const fila = item.fila;
                    const tipoEfectivoModoActual = tipoEfectivoDe(fila, modo);
                    const modoAplica = planificadoAbierto && fila.marcasPermitidas.includes(tipoEfectivoModoActual);

                    return (
                      <Fragment key={`${fila.tipo}-${fila.id}`}>
                        {columnas.map((c, i) => {
                          const marca = marcas.get(claveMarca(fila.tipo, fila.id, c.fecha));
                          return (
                            <div
                              key={c.fecha}
                              onClick={() => modoAplica && handleClickCelda(fila, c.fecha)}
                              title={
                                !planificadoAbierto
                                  ? 'Planificado cerrado — reactivalo para editar'
                                  : !modoAplica
                                  ? 'El modo activo no aplica a esta actividad'
                                  : marca === 'cierre'
                                  ? 'Hito: fecha comprometida'
                                  : undefined
                              }
                              style={{ gridColumn: 1 + i, gridRow: filaGrid, height: ALTO_FILA_DATO }}
                              className={`border border-slate-300 ${bordeGrupoDia(i)} ${
                                c.esHoy ? 'border-l-4 border-r-4 border-l-purple-600 border-r-purple-600' : ''
                              } ${modoAplica ? 'cursor-pointer hover:opacity-70' : 'cursor-not-allowed'} ${
                                !modoAplica
                                  ? 'bg-gray-100'
                                  : c.esFeriado
                                  ? 'bg-orange-100'
                                  : c.esHoy
                                  ? 'bg-purple-50'
                                  : 'bg-white'
                              }`}
                            >
                              {marca && (
                                <div className={`w-full h-full flex items-center justify-center ${coloresMarca[marca]}`}>
                                  {marca === 'cierre' && <span className="text-white font-bold text-sm">H</span>}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </Fragment>
                    );
                  })}
                  {cantidadFilas === 0 && (
                    <div style={{ gridColumn: '1 / -1', gridRow: 4 }} className="text-center text-gray-400 py-8">
                      Sin actividades todavía — agregá tareas matrices o historias de usuario.
                    </div>
                  )}
                </div>
              </div>

              <div
                style={{ width: ANCHO_PANEL_FIJO }}
                className="absolute top-0 left-0 h-full z-40 overflow-hidden bg-white border-r-2 border-slate-300 text-xs"
              >
                <div style={{ display: 'flex', height: ALTO_ENCABEZADO }}>
                  <div
                    style={{ width: ANCHO_H }}
                    className="h-full bg-slate-100 border flex items-end justify-center pb-1 flex-shrink-0"
                    title="Hito: fecha comprometida (planificada)"
                  >
                    H
                  </div>
                  <div
                    style={{ width: ANCHO_ACTIVIDAD }}
                    className="h-full bg-slate-100 border px-2 py-1 flex items-end flex-shrink-0"
                  >
                    Actividad
                  </div>
                  <div
                    style={{ width: ANCHO_MIEMBROS }}
                    className="h-full bg-slate-100 border flex items-end justify-center flex-shrink-0 shadow-[4px_0_6px_-3px_rgba(15,23,42,0.25)]"
                  >
                    Miembros
                  </div>
                </div>

                <div style={{ position: 'absolute', top: ALTO_ENCABEZADO, left: 0, right: 0, bottom: 0, overflow: 'hidden' }}>
                  <div ref={panelFijoBodyRef}>
                    {itemsRender.map((item) => {
                      if (item.kind === 'divisor') {
                        const estilo = ESTILOS_DIVISOR[item.nivel];
                        const porcentajeGrupo =
                          item.diasGrupo != null ? calcularPorcentaje(item.diasGrupo, totalGeneral) : null;
                        return (
                          <div
                            key={item.key}
                            style={{ height: ALTO_FILA_DIVISOR }}
                            className={`border px-2 flex items-center font-semibold text-[11px] whitespace-nowrap ${estilo.fila} ${estilo.padding}`}
                          >
                            {item.label}
                            {item.diasGrupo != null && (
                              <span className="font-normal opacity-80">
                                {' '}
                                ({item.diasGrupo} día{item.diasGrupo === 1 ? '' : 's'}
                                {porcentajeGrupo != null ? ` · ${porcentajeGrupo}%` : ''})
                              </span>
                            )}
                          </div>
                        );
                      }

                      const fila = item.fila;
                      const porcentajePropio =
                        fila.diasPropios != null ? calcularPorcentaje(fila.diasPropios, totalGeneral) : null;
                      const hitos = hitosPorFila.get(`${fila.tipo}-${fila.id}`) ?? [];

                      return (
                        <div
                          key={`${fila.tipo}-${fila.id}`}
                          style={{ display: 'flex', height: ALTO_FILA_DATO }}
                          className="hover:bg-blue-50"
                        >
                          <div
                            style={{ width: ANCHO_H }}
                            className="h-full bg-white border flex items-center justify-center flex-shrink-0"
                          >
                            {hitos.length > 0 && (
                              <span
                                title={`Fecha${hitos.length > 1 ? 's' : ''} comprometida${hitos.length > 1 ? 's' : ''}: ${hitos
                                  .map(formatFechaCorta)
                                  .join(', ')}`}
                                className="inline-flex items-center justify-center min-w-[20px] h-5 px-0.5 bg-blue-700 text-white text-[10px] font-bold rounded cursor-help"
                              >
                                H{hitos.length > 1 ? `×${hitos.length}` : ''}
                              </span>
                            )}
                          </div>
                          <div
                            style={{ width: ANCHO_ACTIVIDAD }}
                            className="h-full bg-white border px-2 py-1 pl-3 overflow-hidden flex-shrink-0"
                          >
                            <div className="font-medium text-gray-900 flex items-start gap-1.5 min-w-0">
                              <span className="min-w-0 line-clamp-2 leading-tight break-words">
                                {fila.esActividadCierre && (
                                  <span title="Actividad de cierre de la funcionalidad" className="mr-1">
                                    🏁
                                  </span>
                                )}
                                {fila.etiqueta}
                                {fila.diasPropios != null && (
                                  <span className="font-normal text-gray-400">
                                    {' '}
                                    ({fila.diasPropios} día{fila.diasPropios === 1 ? '' : 's'}
                                    {porcentajePropio != null ? ` · ${porcentajePropio}%` : ''})
                                  </span>
                                )}
                              </span>
                              <button
                                onClick={() => setModalTituloCompleto(fila.etiqueta)}
                                title="Ver título completo"
                                className="flex-shrink-0 text-gray-400 hover:text-gray-700 leading-none px-0.5"
                              >
                                ⋯
                              </button>
                            </div>
                          </div>
                          <div
                            style={{ width: ANCHO_MIEMBROS }}
                            className="h-full bg-white border px-1 flex items-center justify-center flex-shrink-0 shadow-[4px_0_6px_-3px_rgba(15,23,42,0.25)]"
                          >
                            <SelectorMiembros
                              endpoint={
                                fila.tipo === 'hu'
                                  ? `/api/historias-usuario/${fila.id}/miembros`
                                  : `/api/tareas-matrices/${fila.id}/miembros`
                              }
                              miembrosProyecto={estructura.miembros}
                              miembrosAsignados={fila.miembros}
                              onRefrescar={cargarSilencioso}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {mostrarImportar && (
        <Modal titulo="Importar Excel — Gantt Planificado" onClose={() => setMostrarImportar(false)}>
          <FormularioImportarGanttExcel
            endpoint={`/api/proyectos/${proyectoId}/gantt/importar-excel`}
            onSuccess={cargar}
          />
        </Modal>
      )}

      {mostrarImportarPlanExterno && (
        <Modal
          titulo="Importar Plan de Trabajo (Excel externo)"
          onClose={() => setMostrarImportarPlanExterno(false)}
          ancho="max-w-xl"
        >
          <FormularioImportarPlanExterno
            endpoint={`/api/proyectos/${proyectoId}/gantt/importar-plan-externo`}
            onSuccess={cargar}
          />
        </Modal>
      )}

      {mostrarSprints && estructura?.proyecto.pi_id && (
        <EditarSprintsModal
          piId={estructura.proyecto.pi_id}
          sprints={sprints}
          onClose={() => setMostrarSprints(false)}
          onCambio={cargar}
        />
      )}

      {modalTituloCompleto && (
        <Modal titulo="Actividad" onClose={() => setModalTituloCompleto(null)} ancho="max-w-md">
          <p className="text-sm text-gray-800 break-words">{modalTituloCompleto}</p>
        </Modal>
      )}
    </div>
  );
}
