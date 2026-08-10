// app/proyectos/[id]/gantt-real/page.tsx
// Vista Gantt REAL: mismas columnas (sprints/días) que el planificado,
// pero acá se marca la ejecución real. Cada celda muestra el planificado
// como un anillo de referencia y lo real como el relleno sólido, para
// poder comparar de un vistazo. Solo se puede marcar mientras el
// planificado del proyecto está 'cerrado' — si está en Control de Cambios
// (reactivado), el real queda de solo lectura hasta que se cierre de
// nuevo.

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import SelectorMiembros from '@/components/SelectorMiembros';
import Modal from '@/components/Modal';
import FormularioImportarGanttExcel from '@/components/FormularioImportarGanttExcel';
import { EstructuraProyecto, Sprint, Feriado, Miembro } from '@/types';
import { calcularTotalesDias, calcularPorcentaje } from '@/lib/planificacion';
import { porcentaje as porcentajeCumplim, calcularSemaforo, Semaforo } from '@/lib/avanceCedula';
import { exportarGanttComoExcel, ItemExcel } from '@/lib/exportarGanttExcel';

type Modo = 'desarrollo' | 'certificacion' | 'cierre';

interface FilaGantt {
  tipo: 'tareaMatriz' | 'hu';
  id: number;
  etiqueta: string;
  contexto: string;
  marcasPermitidas: string[];
  fechaCierre?: string;
  miembros: Miembro[];
  diasPropios?: number;
  porcentajeCumplimiento?: number | null;
  semaforo?: Semaforo;
}

type NivelDivisor = 'etapa' | 'modulo' | 'epica';

type ItemRender =
  | { kind: 'divisor'; nivel: NivelDivisor; label: string; key: string; diasGrupo?: number }
  | { kind: 'fila'; fila: FilaGantt };

const ANCHO_ACTIVIDAD = 220;
const ANCHO_H = 36;
const ANCHO_MIEMBROS = 96;

function formatFechaCorta(fecha: string): string {
  return new Date(fecha.slice(0, 10) + 'T00:00:00').toLocaleDateString('es', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

interface Columna {
  fecha: string;
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
  return sprint.tipo === 'priorizacion' ? 'Priorización' : `Sprint ${sprint.numero}`;
}

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

function construirFilas(estructura: EstructuraProyecto): FilaGantt[] {
  const filas: FilaGantt[] = [];
  for (const etapa of estructura.etapas) {
    for (const t of etapa.tareasMatrices) {
      filas.push({
        tipo: 'tareaMatriz',
        id: t.id,
        etiqueta: t.titulo,
        contexto: etapa.nombre,
        marcasPermitidas: ['trabajo', 'cierre'],
        miembros: [],
      });
    }
    for (const modulo of etapa.modulos) {
      for (const epica of modulo.epicas) {
        for (const h of epica.historias) {
          filas.push({
            tipo: 'hu',
            id: h.id,
            etiqueta: (h.codigo ? `${h.codigo} — ` : '') + h.titulo,
            contexto: `${etapa.nombre} / ${modulo.nombre} / ${epica.nombre}`,
            marcasPermitidas: ['desarrollo', 'certificacion', 'cierre'],
            miembros: [],
          });
        }
      }
    }
  }
  return filas;
}

function claveMarca(tipo: string, id: number, fecha: string): string {
  return `${tipo}-${id}-${fecha}`;
}

interface IndiceMarcas {
  conteos: Map<string, number>; // "tipo-id" -> días marcados (sin contar cierre)
  cierres: Map<string, string>; // "tipo-id" -> fecha del cierre, si hay
}

// Agrupa el mapa plano de marcas ("tipo-id-fecha" -> tipo_marca) por fila,
// para poder recalcular en vivo (sin round-trip al servidor) los días,
// porcentajes y semáforo apenas cambia `marcas`/`marcasPlanificadas`.
function indexarMarcasPorFila(marcas: Map<string, string>): IndiceMarcas {
  const conteos = new Map<string, number>();
  const cierres = new Map<string, string>();
  for (const [key, valor] of marcas) {
    const filaKey = key.slice(0, key.length - 11); // quita "-yyyy-mm-dd" (11 chars)
    if (valor === 'cierre') {
      cierres.set(filaKey, key.slice(key.length - 10));
    } else {
      conteos.set(filaKey, (conteos.get(filaKey) ?? 0) + 1);
    }
  }
  return { conteos, cierres };
}

// Igual que en el planificado, pero los días/porcentaje del título, el "H"
// de cierre y el semáforo se calculan en vivo a partir de los índices de
// `marcas`/`marcasPlanificadas` (no de `estructura`), para que se
// actualicen al instante apenas se marca una celda, sin recargar.
function construirItemsRender(estructura: EstructuraProyecto, indexReal: IndiceMarcas, indexPlan: IndiceMarcas): ItemRender[] {
  const items: ItemRender[] = [];

  const calcularFila = (tipo: 'tareaMatriz' | 'hu', id: number) => {
    const filaKey = `${tipo}-${id}`;
    const diasReales = indexReal.conteos.get(filaKey) ?? 0;
    const diasPlanificados = indexPlan.conteos.get(filaKey) ?? 0;
    const fechaCierre = indexReal.cierres.get(filaKey);
    const pct = porcentajeCumplim(diasReales, diasPlanificados);
    const semaforo = calcularSemaforo(diasPlanificados, pct);
    return { diasReales, fechaCierre, porcentajeCumplimiento: pct, semaforo };
  };

  for (const etapa of estructura.etapas) {
    items.push({ kind: 'divisor', nivel: 'etapa', label: etapa.nombre, key: `etapa-${etapa.id}` });

    for (const t of etapa.tareasMatrices) {
      const calc = calcularFila('tareaMatriz', t.id);
      items.push({
        kind: 'fila',
        fila: {
          tipo: 'tareaMatriz',
          id: t.id,
          etiqueta: t.titulo,
          contexto: etapa.nombre,
          marcasPermitidas: ['trabajo', 'cierre'],
          fechaCierre: calc.fechaCierre,
          miembros: t.miembros,
          diasPropios: calc.diasReales,
          porcentajeCumplimiento: calc.porcentajeCumplimiento,
          semaforo: calc.semaforo,
        },
      });
    }

    for (const modulo of etapa.modulos) {
      items.push({ kind: 'divisor', nivel: 'modulo', label: modulo.nombre, key: `modulo-${modulo.id}` });

      for (const epica of modulo.epicas) {
        let diasEpicaReal = 0;
        const filasEpica: ItemRender[] = [];

        for (const h of epica.historias) {
          const calc = calcularFila('hu', h.id);
          diasEpicaReal += calc.diasReales;
          filasEpica.push({
            kind: 'fila',
            fila: {
              tipo: 'hu',
              id: h.id,
              etiqueta: (h.codigo ? `${h.codigo} — ` : '') + h.titulo,
              contexto: `${etapa.nombre} / ${modulo.nombre} / ${epica.nombre}`,
              marcasPermitidas: ['desarrollo', 'certificacion', 'cierre'],
              fechaCierre: calc.fechaCierre,
              miembros: h.miembros,
              diasPropios: calc.diasReales,
              porcentajeCumplimiento: calc.porcentajeCumplimiento,
              semaforo: calc.semaforo,
            },
          });
        }

        items.push({
          kind: 'divisor',
          nivel: 'epica',
          label: epica.nombre,
          key: `epica-${epica.id}`,
          diasGrupo: diasEpicaReal,
        });
        items.push(...filasEpica);
      }
    }
  }
  return items;
}

function tipoEfectivoDe(fila: FilaGantt, modo: Modo): string {
  return modo === 'desarrollo' && fila.tipo === 'tareaMatriz' ? 'trabajo' : modo;
}

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

// Anillo de referencia del planificado, dibujado detrás/alrededor de la
// marca real para poder comparar en la misma celda.
const anillosPlanificado: Record<string, string> = {
  desarrollo: 'ring-2 ring-inset ring-green-500',
  trabajo: 'ring-2 ring-inset ring-green-500',
  certificacion: 'ring-2 ring-inset ring-orange-500',
  cierre: 'ring-2 ring-inset ring-blue-700',
};

const SEMAFORO_COLOR: Record<Semaforo, string> = {
  verde: 'bg-green-500',
  amarillo: 'bg-yellow-500',
  rojo: 'bg-red-500',
  negro: 'bg-gray-700',
};

const SEMAFORO_LABEL: Record<Semaforo, string> = {
  verde: 'En tiempo (desviación ≤ 5%)',
  amarillo: 'Alerta (desviación 5%–8%)',
  rojo: 'Atrasado (desviación > 8%)',
  negro: 'Sin días planificados todavía',
};

const MODOS: { valor: Modo; label: string; color: string }[] = [
  { valor: 'desarrollo', label: '🟢 Desarrollo / Trabajo', color: 'bg-green-500' },
  { valor: 'certificacion', label: '🟠 Certificación', color: 'bg-orange-400' },
  { valor: 'cierre', label: '🔵 Cierre', color: 'bg-blue-600' },
];

export default function GanttRealPage() {
  const params = useParams();
  const proyectoId = parseInt(params.id as string, 10);

  const [estructura, setEstructura] = useState<EstructuraProyecto | null>(null);
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [feriados, setFeriados] = useState<Feriado[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modo, setModo] = useState<Modo>('desarrollo');
  const [marcas, setMarcas] = useState<Map<string, string>>(new Map());
  const [marcasPlanificadas, setMarcasPlanificadas] = useState<Map<string, string>>(new Map());
  const [sidebarAbierto, setSidebarAbierto] = useState(true);
  const [exportando, setExportando] = useState(false);
  const [mostrarImportar, setMostrarImportar] = useState(false);

  const cargar = useCallback(async () => {
    try {
      setLoading(true);
      const [res, resSprints, resFeriados] = await Promise.all([
        fetch(`/api/proyectos/${proyectoId}/estructura`),
        fetch('/api/sprints'),
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

      const mReal = new Map<string, string>();
      const mPlan = new Map<string, string>();
      for (const etapa of data.data.etapas) {
        for (const t of etapa.tareasMatrices) {
          for (const d of t.diasReales) mReal.set(claveMarca('tareaMatriz', t.id, d.fecha.slice(0, 10)), d.tipo_marca);
          for (const d of t.diasPlanificados)
            mPlan.set(claveMarca('tareaMatriz', t.id, d.fecha.slice(0, 10)), d.tipo_marca);
        }
        for (const modulo of etapa.modulos) {
          for (const epica of modulo.epicas) {
            for (const h of epica.historias) {
              for (const d of h.diasReales) mReal.set(claveMarca('hu', h.id, d.fecha.slice(0, 10)), d.tipo_marca);
              for (const d of h.diasPlanificados)
                mPlan.set(claveMarca('hu', h.id, d.fecha.slice(0, 10)), d.tipo_marca);
            }
          }
        }
      }
      setMarcas(mReal);
      setMarcasPlanificadas(mPlan);
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
  const filas = useMemo(() => (estructura ? construirFilas(estructura) : []), [estructura]);
  const indexReal = useMemo(() => indexarMarcasPorFila(marcas), [marcas]);
  const indexPlan = useMemo(() => indexarMarcasPorFila(marcasPlanificadas), [marcasPlanificadas]);
  const itemsRender = useMemo(
    () => (estructura ? construirItemsRender(estructura, indexReal, indexPlan) : []),
    [estructura, indexReal, indexPlan]
  );
  // Totales calculados directamente del mapa de marcas en vivo (no de
  // `estructura`) para que se actualicen al instante al marcar una celda,
  // sin necesitar recargar la página.
  const totalesReal = useMemo(() => {
    let desarrollo = 0;
    let certificacion = 0;
    for (const valor of marcas.values()) {
      if (valor === 'desarrollo' || valor === 'trabajo') desarrollo++;
      else if (valor === 'certificacion') certificacion++;
    }
    return { desarrollo, certificacion };
  }, [marcas]);
  const totalesPlan = useMemo(
    () => (estructura ? calcularTotalesDias(estructura, 'diasPlanificados') : { desarrollo: 0, certificacion: 0 }),
    [estructura]
  );
  const totalGeneralReal = totalesReal.desarrollo + totalesReal.certificacion;
  const totalGeneralPlan = totalesPlan.desarrollo + totalesPlan.certificacion;
  const puedeEditar = estructura?.proyecto.estado_planificacion === 'cerrado';

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

  const handleClickCelda = (fila: FilaGantt, fecha: string) => {
    if (!puedeEditar) return;
    const tipoEfectivo = tipoEfectivoDe(fila, modo);
    if (!fila.marcasPermitidas.includes(tipoEfectivo)) return;

    const key = claveMarca(fila.tipo, fila.id, fecha);

    setMarcas((prev) => {
      const next = new Map(prev);
      if (tipoEfectivo === 'cierre') {
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
      fila.tipo === 'hu' ? `/api/historias-usuario/${fila.id}/dias-reales` : `/api/tareas-matrices/${fila.id}/dias-reales`;

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
        setMarcas((prev) => {
          const next = new Map(prev);
          if (next.get(key) === tipoEfectivo) next.delete(key);
          return next;
        });
      });
  };

  const handleExportarExcel = async () => {
    setExportando(true);
    try {
      const sufijo = (dias: number) => {
        const pct = calcularPorcentaje(dias, totalGeneralReal);
        return ` (${dias} día${dias === 1 ? '' : 's'}${pct != null ? ` · ${pct}%` : ''})`;
      };

      const items: ItemExcel[] = itemsRender.map((item) =>
        item.kind === 'divisor'
          ? { kind: 'divisor', nivel: item.nivel, label: item.label + (item.diasGrupo != null ? sufijo(item.diasGrupo) : '') }
          : {
              kind: 'fila',
              tipo: item.fila.tipo,
              id: item.fila.id,
              etiqueta: item.fila.etiqueta + (item.fila.diasPropios != null ? sufijo(item.fila.diasPropios) : ''),
              contexto: item.fila.contexto,
              fechaCierre: item.fila.fechaCierre,
              miembros: item.fila.miembros.map((m) => m.iniciales).join('/'),
            }
      );

      const nombre = `Gantt-Real-${estructura?.proyecto.nombre || proyectoId}`.replace(/[^\w-]+/g, '_');
      await exportarGanttComoExcel({
        nombreArchivo: nombre,
        nombreHoja: 'Gantt Real',
        columnas,
        items,
        marcas,
        marcasPlanificadas,
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
                <h1 className="text-2xl font-bold text-gray-900">🎯 Gantt Real</h1>
                {estructura && <p className="text-gray-600 text-sm mt-1">{estructura.proyecto.nombre}</p>}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <a
                href={`/proyectos/${proyectoId}/avance-cedula`}
                className="px-4 py-2 rounded-lg text-sm font-semibold bg-purple-600 text-white hover:bg-purple-700"
              >
                📋 Avance Célula
              </a>
              <a
                href={`/proyectos/${proyectoId}/gantt`}
                className="px-4 py-2 rounded-lg text-sm font-semibold bg-white border-2 border-slate-300 text-slate-700 hover:bg-slate-50"
              >
                📊 Ir al Planificado
              </a>
              {estructura && columnas.length > 0 && (
                <button
                  onClick={handleExportarExcel}
                  disabled={exportando}
                  className="px-4 py-2 rounded-lg text-sm font-semibold bg-white border-2 border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  {exportando ? '⏳ Exportando...' : '📊 Exportar Excel'}
                </button>
              )}
              {estructura && columnas.length > 0 && puedeEditar && (
                <button
                  onClick={() => setMostrarImportar(true)}
                  className="px-4 py-2 rounded-lg text-sm font-semibold bg-white border-2 border-slate-300 text-slate-700 hover:bg-slate-50"
                >
                  📥 Importar Excel
                </button>
              )}
              <a href={`/proyectos/${proyectoId}`} className="text-sm text-blue-600 hover:text-blue-800 font-semibold">
                ← Volver a la estructura
              </a>
            </div>
          </div>

          <p className="mb-4 -mt-2 text-xs text-gray-400">
            🟣 La columna resaltada marca <strong>HOY</strong> — el reporte &quot;Avance Célula&quot; toma el corte a
            esta fecha.
          </p>

          {!puedeEditar && (
            <div className="mb-4 bg-amber-50 border border-amber-300 text-amber-800 px-4 py-2 rounded-lg text-sm font-medium">
              🔒 El real es de solo lectura: el planificado tiene que estar &quot;Cerrado&quot; para poder registrar
              ejecución.{' '}
              <a href={`/proyectos/${proyectoId}/gantt`} className="underline font-semibold">
                Andá al Planificado y cerralo
              </a>{' '}
              para habilitar el marcado acá.
            </div>
          )}

          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm">
              {error}
            </div>
          )}

          {loading && <div className="animate-pulse h-32 bg-gray-200 rounded mb-4" />}

          {!loading && estructura && columnas.length === 0 && (
            <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500 mb-4">
              Todavía no hay sprints generados.{' '}
              <a href="/sprints" className="text-blue-600 hover:text-blue-800 font-semibold">
                Generalos primero acá
              </a>
              .
            </div>
          )}
        </div>

        {!loading && estructura && columnas.length > 0 && (
          <div className="flex-1 min-h-0 flex flex-col px-6 pb-6">
            <div className="flex items-center gap-6 mb-3 bg-white rounded-lg shadow px-4 py-2 text-sm flex-shrink-0 flex-wrap">
              <span className="font-semibold text-gray-700">🎯 Días reales:</span>
              <span className="flex items-center gap-1.5 text-gray-600">
                <span className="w-3 h-3 rounded bg-green-500 inline-block" /> Desarrollo:{' '}
                <strong className="text-gray-900">{totalesReal.desarrollo}</strong>
              </span>
              <span className="flex items-center gap-1.5 text-gray-600">
                <span className="w-3 h-3 rounded bg-orange-400 inline-block" /> Certificación:{' '}
                <strong className="text-gray-900">{totalesReal.certificacion}</strong>
              </span>
              <span className="text-gray-600">
                Total: <strong className="text-gray-900">{totalGeneralReal}</strong> día(s)
              </span>
              <span className="text-gray-400">|</span>
              <span className="text-gray-500">
                📊 Planificado: {totalesPlan.desarrollo} + {totalesPlan.certificacion} ={' '}
                <strong>{totalGeneralPlan}</strong> día(s)
              </span>
            </div>

            <div className="flex justify-between items-center gap-4 mb-4 bg-white rounded-lg shadow p-3 flex-shrink-0">
              <div className="flex gap-2 items-center">
                <span className="text-sm text-gray-500 mr-1">Marcando (real):</span>
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
              <div className="flex items-center gap-4 text-xs text-gray-500">
                <span className="flex items-center gap-1" title="% de cumplimiento = días reales / días planificados de esa fila">
                  <span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block" />
                  <span className="w-2.5 h-2.5 rounded-full bg-yellow-500 inline-block" />
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" />
                  <span className="w-2.5 h-2.5 rounded-full bg-gray-700 inline-block" /> Semáforo (% cumplimiento)
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded ring-2 ring-inset ring-green-500 bg-white inline-block" /> Planificado
                  (referencia)
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded bg-orange-200 inline-block" /> Feriado
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-3 rounded bg-purple-600 inline-block" /> Hoy
                </span>
                <span>
                  {columnas.length} día(s) · {filas.length} actividad(es)
                </span>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow overflow-auto flex-1 min-h-0">
              <table className="border-collapse text-xs">
                <thead className="sticky top-0 z-20">
                  <tr>
                    <th
                      rowSpan={3}
                      style={{ width: ANCHO_ACTIVIDAD }}
                      className="sticky top-0 left-0 z-30 bg-slate-100 border px-2 py-1 text-left align-bottom"
                    >
                      Actividad
                    </th>
                    <th
                      rowSpan={3}
                      style={{ left: ANCHO_ACTIVIDAD, width: ANCHO_H }}
                      className="sticky top-0 z-30 bg-slate-100 border text-center align-bottom"
                      title="Fecha real de cierre"
                    >
                      H
                    </th>
                    <th
                      rowSpan={3}
                      style={{ left: ANCHO_ACTIVIDAD + ANCHO_H, width: ANCHO_MIEMBROS }}
                      className="sticky top-0 z-30 bg-slate-100 border text-center align-bottom"
                    >
                      Miembros
                    </th>
                    {gruposMes.map((g, i) => (
                      <th
                        key={`${g.label}-${i}`}
                        colSpan={g.cantidad}
                        className="border-y border-r border-l-2 border-slate-400 px-1 py-1 text-center font-semibold bg-green-100 text-green-900"
                      >
                        {g.label}
                      </th>
                    ))}
                  </tr>
                  <tr>
                    {gruposSprint.map((g, i) => (
                      <th
                        key={`${g.label}-${i}`}
                        colSpan={g.cantidad}
                        className="border-y border-r border-l-2 border-slate-400 px-1 py-1 text-center font-semibold bg-green-100 text-green-900"
                      >
                        {g.label}
                      </th>
                    ))}
                  </tr>
                  <tr>
                    {columnas.map((c) => (
                      <th
                        key={c.fecha}
                        title={c.esHoy ? `${c.fecha} — HOY, corte de Avance Célula` : c.fecha}
                        className={`border-2 w-11 h-8 text-[11px] font-semibold tabular-nums ${
                          c.esInicioGrupo ? 'border-l-4 border-l-slate-800' : ''
                        } ${
                          c.esHoy
                            ? 'border-purple-700 bg-purple-600 text-white'
                            : c.esFeriado
                            ? 'border-slate-600 bg-orange-200 text-orange-800'
                            : 'border-slate-600 bg-slate-50 text-gray-700'
                        }`}
                      >
                        {c.esHoy ? 'HOY' : `${c.diaSemana}${String(c.diaMes).padStart(2, '0')}`}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {itemsRender.map((item) => {
                    if (item.kind === 'divisor') {
                      const estilo = ESTILOS_DIVISOR[item.nivel];
                      const porcentajeGrupo =
                        item.diasGrupo != null ? calcularPorcentaje(item.diasGrupo, totalGeneralReal) : null;
                      return (
                        <tr key={item.key}>
                          <td
                            colSpan={3}
                            className={`sticky left-0 z-10 border px-2 py-1.5 h-7 font-semibold text-[11px] whitespace-nowrap ${estilo.fila} ${estilo.padding}`}
                          >
                            {item.label}
                            {item.diasGrupo != null && (
                              <span className="font-normal opacity-80">
                                {' '}
                                ({item.diasGrupo} día{item.diasGrupo === 1 ? '' : 's'}
                                {porcentajeGrupo != null ? ` · ${porcentajeGrupo}%` : ''})
                              </span>
                            )}
                          </td>
                          <td colSpan={columnas.length} className={`border h-7 ${estilo.celda}`} />
                        </tr>
                      );
                    }

                    const fila = item.fila;
                    const tipoEfectivoModoActual = tipoEfectivoDe(fila, modo);
                    const modoAplica = puedeEditar && fila.marcasPermitidas.includes(tipoEfectivoModoActual);
                    const porcentajePropio =
                      fila.diasPropios != null ? calcularPorcentaje(fila.diasPropios, totalGeneralReal) : null;

                    return (
                      <tr key={`${fila.tipo}-${fila.id}`} className="hover:bg-blue-50">
                        <td
                          title={fila.etiqueta}
                          style={{ width: ANCHO_ACTIVIDAD }}
                          className="sticky left-0 z-10 bg-white border px-2 py-1 pl-8 overflow-hidden"
                        >
                          <div className="font-medium text-gray-900 flex items-center gap-1.5 min-w-0">
                            {fila.semaforo && (
                              <span
                                title={`${SEMAFORO_LABEL[fila.semaforo]}${
                                  fila.porcentajeCumplimiento != null ? ` — Cumplimiento: ${fila.porcentajeCumplimiento}%` : ''
                                }`}
                                className={`flex-shrink-0 px-1.5 py-0.5 rounded text-white text-[10px] font-bold leading-none ${SEMAFORO_COLOR[fila.semaforo]}`}
                              >
                                {fila.porcentajeCumplimiento != null ? `${fila.porcentajeCumplimiento}%` : '—'}
                              </span>
                            )}
                            <span className="truncate min-w-0">
                              {fila.etiqueta}
                              {fila.diasPropios != null && (
                                <span className="font-normal text-gray-400">
                                  {' '}
                                  ({fila.diasPropios} día{fila.diasPropios === 1 ? '' : 's'}
                                  {porcentajePropio != null ? ` · ${porcentajePropio}%` : ''})
                                </span>
                              )}
                            </span>
                          </div>
                          <div className="text-[10px] text-gray-400 truncate">{fila.contexto}</div>
                        </td>
                        <td
                          style={{ left: ANCHO_ACTIVIDAD, width: ANCHO_H }}
                          className="sticky z-10 bg-white border text-center"
                        >
                          {fila.fechaCierre && (
                            <span
                              title={`Fecha real de cierre: ${formatFechaCorta(fila.fechaCierre)}`}
                              className="inline-flex items-center justify-center w-5 h-5 bg-blue-700 text-white text-[10px] font-bold rounded cursor-help"
                            >
                              H
                            </span>
                          )}
                        </td>
                        <td
                          style={{ left: ANCHO_ACTIVIDAD + ANCHO_H, width: ANCHO_MIEMBROS }}
                          className="sticky z-10 bg-white border text-center px-1"
                        >
                          <SelectorMiembros
                            endpoint={
                              fila.tipo === 'hu'
                                ? `/api/historias-usuario/${fila.id}/miembros`
                                : `/api/tareas-matrices/${fila.id}/miembros`
                            }
                            miembrosProyecto={estructura.miembros}
                            miembrosAsignados={fila.miembros}
                            onRefrescar={cargar}
                          />
                        </td>
                        {columnas.map((c) => {
                          const marca = marcas.get(claveMarca(fila.tipo, fila.id, c.fecha));
                          const marcaPlan = marcasPlanificadas.get(claveMarca(fila.tipo, fila.id, c.fecha));
                          return (
                            <td
                              key={c.fecha}
                              onClick={() => modoAplica && handleClickCelda(fila, c.fecha)}
                              title={
                                !puedeEditar
                                  ? 'Cerrá el planificado para poder registrar el real'
                                  : !modoAplica
                                  ? 'El modo activo no aplica a esta actividad'
                                  : marcaPlan
                                  ? `Planificado: ${marcaPlan}`
                                  : undefined
                              }
                              className={`border-2 border-slate-500 w-11 h-8 text-center ${
                                c.esInicioGrupo ? 'border-l-4 border-l-slate-800' : ''
                              } ${c.esHoy ? 'border-l-4 border-r-4 border-l-purple-600 border-r-purple-600' : ''} ${
                                modoAplica ? 'cursor-pointer hover:opacity-70' : 'cursor-not-allowed'
                              } ${marcaPlan ? anillosPlanificado[marcaPlan] : ''} ${
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
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                  {filas.length === 0 && (
                    <tr>
                      <td colSpan={columnas.length + 3} className="text-center text-gray-400 py-8">
                        Sin actividades todavía — agregá tareas matrices o historias de usuario.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {mostrarImportar && (
        <Modal titulo="Importar Excel — Gantt Real" onClose={() => setMostrarImportar(false)}>
          <FormularioImportarGanttExcel
            endpoint={`/api/proyectos/${proyectoId}/gantt-real/importar-excel`}
            onSuccess={cargar}
          />
        </Modal>
      )}
    </div>
  );
}
