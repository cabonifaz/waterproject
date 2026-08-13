// app/proyectos/[id]/gantt/page.tsx
// Vista Gantt planificada: columnas = días hábiles agrupados por sprint,
// filas = tareas matrices y HU. Click en una celda marca/despeja el día
// según el modo activo (desarrollo|trabajo / certificación / cierre).

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import SelectorMiembros from '@/components/SelectorMiembros';
import Modal from '@/components/Modal';
import FormularioImportarGanttExcel from '@/components/FormularioImportarGanttExcel';
import FormularioImportarPlanExterno from '@/components/FormularioImportarPlanExterno';
import { EstructuraProyecto, Sprint, Feriado, Miembro } from '@/types';
import { calcularTotalesPlanificados, calcularPorcentaje, diasPlanificadosEpica } from '@/lib/planificacion';
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
  diasPropios?: number; // solo tareas matrices: días de "trabajo" marcados, para el "(N días · %)" del título
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
  fecha: string; // yyyy-mm-dd
  grupoLabel: string;
  mesLabel: string;
  diaMes: number;
  diaSemana: string;
  esFeriado: boolean;
  esInicioGrupo: boolean;
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

// Los feriados NO se excluyen (a diferencia de los fines de semana): se
// muestran como columna normal pero marcada, para que se vea resaltada en
// todas las filas del Gantt (ver `esFeriado` al renderizar).
function calcularColumnas(sprints: Sprint[], feriados: Set<string>): Columna[] {
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

// Igual que construirFilas, pero intercala filas-divisor (etapa/módulo/épica)
// para que se vea la jerarquía en el Gantt: una barra completa que corta
// todos los días de todos los sprints, con el nombre en la columna de
// Actividad. Cada épica lleva su total de días planificados (desarrollo +
// certificación de sus HU) y cada tarea matriz el conteo de días de
// "trabajo" — ambos usados después para el "(N días · %)" junto al nombre.
function construirItemsRender(estructura: EstructuraProyecto): ItemRender[] {
  const items: ItemRender[] = [];
  for (const etapa of estructura.etapas) {
    items.push({ kind: 'divisor', nivel: 'etapa', label: etapa.nombre, key: `etapa-${etapa.id}` });

    for (const t of etapa.tareasMatrices) {
      const diasTrabajo = t.diasPlanificados.filter((d) => d.tipo_marca === 'trabajo').length;
      const marcaCierre = t.diasPlanificados.find((d) => d.tipo_marca === 'cierre');
      items.push({
        kind: 'fila',
        fila: {
          tipo: 'tareaMatriz',
          id: t.id,
          etiqueta: t.titulo,
          contexto: etapa.nombre,
          marcasPermitidas: ['trabajo', 'cierre'],
          fechaCierre: marcaCierre?.fecha,
          miembros: t.miembros,
          diasPropios: diasTrabajo,
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
          const marcaCierre = h.diasPlanificados.find((d) => d.tipo_marca === 'cierre');
          items.push({
            kind: 'fila',
            fila: {
              tipo: 'hu',
              id: h.id,
              etiqueta: (h.codigo ? `${h.codigo} — ` : '') + h.titulo,
              contexto: `${etapa.nombre} / ${modulo.nombre} / ${epica.nombre}`,
              marcasPermitidas: ['desarrollo', 'certificacion', 'cierre'],
              fechaCierre: marcaCierre?.fecha,
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
  { valor: 'cierre', label: '🔵 Cierre', color: 'bg-blue-600' },
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
  const filas = useMemo(() => (estructura ? construirFilas(estructura) : []), [estructura]);
  const itemsRender = useMemo(() => (estructura ? construirItemsRender(estructura) : []), [estructura]);
  const totales = useMemo(
    () => (estructura ? calcularTotalesPlanificados(estructura) : { desarrollo: 0, certificacion: 0 }),
    [estructura]
  );
  const totalGeneral = totales.desarrollo + totales.certificacion;
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
        // la petición falló: revertir la marca optimista para no mentirle a la UI
        setMarcas((prev) => {
          const next = new Map(prev);
          if (next.get(key) === tipoEfectivo) next.delete(key);
          return next;
        });
      });
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
              etiqueta: item.fila.etiqueta + (item.fila.diasPropios != null ? sufijo(item.fila.diasPropios) : ''),
              contexto: item.fila.contexto,
              fechaCierre: item.fila.fechaCierre,
              miembros: item.fila.miembros.map((m) => m.iniciales).join('/'),
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
            <div className="flex items-center gap-3">
              <a
                href={`/proyectos/${proyectoId}/gantt-real`}
                className="px-4 py-2 rounded-lg text-sm font-semibold bg-white border-2 border-slate-300 text-slate-700 hover:bg-slate-50"
              >
                🎯 REAL
              </a>
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
            <div className="flex items-center gap-6 mb-3 bg-white rounded-lg shadow px-4 py-2 text-sm flex-shrink-0">
              <span className="font-semibold text-gray-700">📊 Días planificados:</span>
              <span className="flex items-center gap-1.5 text-gray-600">
                <span className="w-3 h-3 rounded bg-green-500 inline-block" /> Desarrollo:{' '}
                <strong className="text-gray-900">{totales.desarrollo}</strong>
              </span>
              <span className="flex items-center gap-1.5 text-gray-600">
                <span className="w-3 h-3 rounded bg-orange-400 inline-block" /> Certificación:{' '}
                <strong className="text-gray-900">{totales.certificacion}</strong>
              </span>
              <span className="text-gray-600">
                Total: <strong className="text-gray-900">{totalGeneral}</strong> día(s)
              </span>
            </div>

            <div className="flex justify-between items-center gap-4 mb-4 bg-white rounded-lg shadow p-3 flex-shrink-0">
              <div className="flex gap-2 items-center">
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
              <div className="flex items-center gap-4 text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded bg-orange-200 inline-block" /> Feriado
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-1 h-3 rounded bg-slate-400 inline-block" /> Inicio de sprint
                </span>
                <span>{columnas.length} día(s) · {filas.length} actividad(es)</span>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow overflow-auto flex-1 min-h-0">
              <table className="table-fixed border-collapse text-xs">
                <colgroup>
                  <col style={{ width: ANCHO_ACTIVIDAD }} />
                  <col style={{ width: ANCHO_H }} />
                  <col style={{ width: ANCHO_MIEMBROS }} />
                  {columnas.map((c) => (
                    <col key={c.fecha} style={{ width: 44 }} />
                  ))}
                </colgroup>
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
                      title="Fecha planificada de cierre"
                    >
                      H
                    </th>
                    <th
                      rowSpan={3}
                      style={{ left: ANCHO_ACTIVIDAD + ANCHO_H, width: ANCHO_MIEMBROS }}
                      className="sticky top-0 z-30 bg-slate-100 border text-center align-bottom shadow-[4px_0_6px_-3px_rgba(15,23,42,0.25)]"
                    >
                      Miembros
                    </th>
                    {gruposMes.map((g, i) => (
                      <th
                        key={`${g.label}-${i}`}
                        colSpan={g.cantidad}
                        className="border-y border-r border-l-4 border-l-slate-900 px-1 py-1 text-center font-semibold bg-green-100 text-green-900"
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
                        className="border-y border-r border-l-2 border-l-slate-500 px-1 py-1 text-center font-semibold bg-green-100 text-green-900"
                      >
                        {g.label}
                      </th>
                    ))}
                  </tr>
                  <tr>
                    {columnas.map((c, i) => (
                      <th
                        key={c.fecha}
                        title={c.fecha}
                        className={`border border-slate-300 w-11 h-8 text-[11px] font-semibold tabular-nums ${bordeGrupoDia(
                          i
                        )} ${c.esFeriado ? 'bg-orange-200 text-orange-800' : 'bg-slate-50 text-gray-700'}`}
                      >
                        {c.diaSemana}
                        {String(c.diaMes).padStart(2, '0')}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                    {itemsRender.map((item) => {
                      if (item.kind === 'divisor') {
                        const estilo = ESTILOS_DIVISOR[item.nivel];
                        const porcentajeGrupo =
                          item.diasGrupo != null ? calcularPorcentaje(item.diasGrupo, totalGeneral) : null;
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
                      const modoAplica = planificadoAbierto && fila.marcasPermitidas.includes(tipoEfectivoModoActual);
                      const porcentajePropio =
                        fila.diasPropios != null ? calcularPorcentaje(fila.diasPropios, totalGeneral) : null;

                      return (
                        <tr key={`${fila.tipo}-${fila.id}`} className="hover:bg-blue-50">
                          <td
                            title={fila.etiqueta}
                            style={{ width: ANCHO_ACTIVIDAD }}
                            className="sticky left-0 z-10 bg-white border px-2 py-1 pl-8 overflow-hidden"
                          >
                            <div className="font-medium text-gray-900 break-words leading-tight">
                              {fila.etiqueta}
                              {fila.diasPropios != null && (
                                <span className="font-normal text-gray-400">
                                  {' '}
                                  ({fila.diasPropios} día{fila.diasPropios === 1 ? '' : 's'}
                                  {porcentajePropio != null ? ` · ${porcentajePropio}%` : ''})
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-gray-400 truncate">{fila.contexto}</div>
                          </td>
                          <td
                            style={{ left: ANCHO_ACTIVIDAD, width: ANCHO_H }}
                            className="sticky z-10 bg-white border text-center"
                          >
                            {fila.fechaCierre && (
                              <span
                                title={`Fecha planificada: ${formatFechaCorta(fila.fechaCierre)}`}
                                className="inline-flex items-center justify-center w-5 h-5 bg-blue-700 text-white text-[10px] font-bold rounded cursor-help"
                              >
                                H
                              </span>
                            )}
                          </td>
                          <td
                            style={{ left: ANCHO_ACTIVIDAD + ANCHO_H, width: ANCHO_MIEMBROS }}
                            className="sticky z-10 bg-white border text-center px-1 shadow-[4px_0_6px_-3px_rgba(15,23,42,0.25)]"
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
                          {columnas.map((c, i) => {
                            const marca = marcas.get(claveMarca(fila.tipo, fila.id, c.fecha));
                            return (
                              <td
                                key={c.fecha}
                                onClick={() => modoAplica && handleClickCelda(fila, c.fecha)}
                                title={
                                  !planificadoAbierto
                                    ? 'Planificado cerrado — reactivalo para editar'
                                    : !modoAplica
                                    ? 'El modo activo no aplica a esta actividad'
                                    : undefined
                                }
                                className={`border border-slate-300 w-11 h-8 text-center ${bordeGrupoDia(i)} ${
                                  modoAplica ? 'cursor-pointer hover:opacity-70' : 'cursor-not-allowed'
                                } ${!modoAplica ? 'bg-gray-100' : c.esFeriado ? 'bg-orange-100' : 'bg-white'}`}
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
    </div>
  );
}
