// components/CargaEquipoVista.tsx
// Vista de carga del equipo (proyecto o PI): resumen por persona (hasta
// qué día tiene tareas, días ocupados, superposiciones), desglose por
// módulo, por sprint y por proyecto, y la carga día por día. Planificado o
// Real, a elección.

'use client';

import { useMemo, useState } from 'react';
import { Sprint } from '@/types';
import { calcularCargaEquipo, CampoCarga, CargaPersona, FuenteCarga, ResumenGrupo } from '@/lib/cargaEquipo';
import { formatFechaCorta } from '@/lib/hitos';

interface Props {
  fuentes: FuenteCarga[];
  sprints: Sprint[];
}

const DIAS_SEMANA = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];

const hoyISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// Siguiente día hábil (lun-vie) después de `fecha`.
function siguienteDiaHabil(fecha: string): string {
  const d = new Date(`${fecha}T00:00:00Z`);
  do d.setUTCDate(d.getUTCDate() + 1);
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6);
  return d.toISOString().slice(0, 10);
}

// Días hábiles de todos los sprints, en orden, con su sprint.
function columnasDias(sprints: Sprint[]) {
  const cols: { fecha: string; sprint: string; etiqueta: string }[] = [];
  for (const s of sprints) {
    const label = s.tipo === 'priorizacion' ? 'Zona Gris' : `Sprint ${s.numero}`;
    const d = new Date(`${String(s.fecha_inicio).slice(0, 10)}T00:00:00Z`);
    const fin = new Date(`${String(s.fecha_fin).slice(0, 10)}T00:00:00Z`);
    for (; d <= fin; d.setUTCDate(d.getUTCDate() + 1)) {
      const dow = d.getUTCDay();
      if (dow === 0 || dow === 6) continue;
      cols.push({
        fecha: d.toISOString().slice(0, 10),
        sprint: label,
        etiqueta: `${DIAS_SEMANA[dow]}${String(d.getUTCDate()).padStart(2, '0')}`,
      });
    }
  }
  return cols;
}

const colorCarga = (n: number) =>
  n === 0 ? 'bg-white' : n === 1 ? 'bg-green-200 text-green-900' : n === 2 ? 'bg-amber-300 text-amber-950' : 'bg-red-400 text-white';

function celdaGrupo(r: ResumenGrupo | undefined) {
  if (!r) return <span className="text-gray-300">—</span>;
  return (
    <span>
      <strong>{r.actividades}</strong> act. · {r.dias} d
    </span>
  );
}

const CargaEquipoVista = ({ fuentes, sprints }: Props) => {
  const [campo, setCampo] = useState<CampoCarga>('diasPlanificados');
  const resultado = useMemo(() => calcularCargaEquipo(fuentes, sprints, campo), [fuentes, sprints, campo]);
  const columnas = useMemo(() => columnasDias(sprints), [sprints]);
  const variosProyectos = fuentes.length > 1;
  const hoy = hoyISO();
  const finPI = columnas.length ? columnas[columnas.length - 1].fecha : null;

  const gruposSprint = useMemo(() => {
    const g: { label: string; cantidad: number }[] = [];
    for (const c of columnas) {
      const u = g[g.length - 1];
      if (u && u.label === c.sprint) u.cantidad++;
      else g.push({ label: c.sprint, cantidad: 1 });
    }
    return g;
  }, [columnas]);

  const sprintsConDatos = resultado.sprints.filter((s) => resultado.personas.some((p) => p.porSprint.has(s)));
  const nombrePersona = (p: CargaPersona) => (
    <span>
      <strong>{p.iniciales}</strong> <span className="text-gray-600">{p.nombre}</span>
    </span>
  );

  const disponibilidad = (p: CargaPersona) => {
    if (!p.ultimaFecha) return <span className="text-gray-400">sin tareas</span>;
    const libre = siguienteDiaHabil(p.ultimaFecha);
    if (p.ultimaFecha < hoy) return <span className="text-green-700 font-semibold">libre (desde {formatFechaCorta(libre)})</span>;
    if (finPI && p.ultimaFecha >= finPI) return <span className="text-gray-500">ocupado hasta el fin del PI</span>;
    return <span className="text-green-700">libre desde {formatFechaCorta(libre)}</span>;
  };

  const tabla = (titulo: string, columnasGrupo: string[], valor: (p: CargaPersona, g: string) => ResumenGrupo | undefined) => (
    <section className="bg-white rounded-lg shadow p-4">
      <h2 className="font-bold text-gray-900 mb-3">{titulo}</h2>
      {columnasGrupo.length === 0 ? (
        <p className="text-sm text-gray-400">Sin datos.</p>
      ) : (
        <div className="overflow-auto">
          <table className="text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100">
                <th className="sticky left-0 bg-slate-100 border px-2 py-1.5 text-left min-w-[180px]">Persona</th>
                {columnasGrupo.map((g) => (
                  <th key={g} className="border px-2 py-1.5 text-center font-semibold whitespace-nowrap">
                    {g}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {resultado.personas.map((p) => (
                <tr key={p.clave}>
                  <td className="sticky left-0 bg-white border px-2 py-1 whitespace-nowrap">{nombrePersona(p)}</td>
                  {columnasGrupo.map((g) => (
                    <td key={g} className="border px-2 py-1 text-center whitespace-nowrap">
                      {celdaGrupo(valor(p, g))}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm text-gray-500">Calcular sobre:</span>
        {(
          [
            ['diasPlanificados', '📊 Planificado'],
            ['diasReales', '🎯 Real'],
          ] as const
        ).map(([valor, label]) => (
          <button
            key={valor}
            onClick={() => setCampo(valor)}
            className={`px-4 py-1.5 rounded-lg text-sm font-semibold border-2 ${
              campo === valor ? 'bg-slate-800 text-white border-transparent' : 'border-gray-200 text-gray-600 bg-white'
            }`}
          >
            {label}
          </button>
        ))}
        {resultado.actividadesSinAsignar > 0 && (
          <span className="text-xs text-amber-700 ml-2">
            ⚠️ {resultado.actividadesSinAsignar} actividad(es) con días marcados no tienen talento asignado.
          </span>
        )}
      </div>

      {resultado.personas.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
          Todavía no hay talentos asignados a actividades con días marcados.
        </div>
      ) : (
        <>
          <section className="bg-white rounded-lg shadow p-4">
            <h2 className="font-bold text-gray-900 mb-3">Resumen por persona</h2>
            <div className="overflow-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-xs">
                    <th className="border px-2 py-2 text-left">Persona</th>
                    {variosProyectos && <th className="border px-2 py-2 text-left">Proyectos</th>}
                    <th className="border px-2 py-2 text-center">Actividades</th>
                    <th className="border px-2 py-2 text-center">Días ocupados</th>
                    <th className="border px-2 py-2 text-center" title="Días con historias de usuario de 2 o más funcionalidades distintas (no cuentan tareas matrices ni actividades de cierre)">
                      Días superpuestos
                    </th>
                    <th className="border px-2 py-2 text-center">Primera tarea</th>
                    <th className="border px-2 py-2 text-center">Última tarea (hasta)</th>
                    <th className="border px-2 py-2 text-left">Disponibilidad</th>
                  </tr>
                </thead>
                <tbody>
                  {resultado.personas.map((p) => (
                    <tr key={p.clave}>
                      <td className="border px-2 py-1.5 whitespace-nowrap">{nombrePersona(p)}</td>
                      {variosProyectos && <td className="border px-2 py-1.5 text-xs">{p.proyectos.join(', ')}</td>}
                      <td className="border px-2 py-1.5 text-center">{p.actividades}</td>
                      <td className="border px-2 py-1.5 text-center">{p.diasOcupados}</td>
                      <td
                        className={`border px-2 py-1.5 text-center ${
                          p.diasSuperpuestos > 0 ? 'bg-amber-100 text-amber-900 font-semibold' : ''
                        }`}
                      >
                        {p.diasSuperpuestos}
                      </td>
                      <td className="border px-2 py-1.5 text-center">{p.primeraFecha ? formatFechaCorta(p.primeraFecha) : '—'}</td>
                      <td className="border px-2 py-1.5 text-center font-semibold">
                        {p.ultimaFecha ? formatFechaCorta(p.ultimaFecha) : '—'}
                      </td>
                      <td className="border px-2 py-1.5 text-xs">{disponibilidad(p)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {tabla('Por módulo / etapa', resultado.modulos.filter((m) => resultado.personas.some((p) => p.porModulo.has(m))), (p, g) =>
            p.porModulo.get(g)
          )}
          {tabla('Por sprint', sprintsConDatos, (p, g) => p.porSprint.get(g))}
          {variosProyectos &&
            tabla(
              'Por proyecto',
              fuentes.map((f) => f.proyecto.nombre),
              (p, g) => p.porProyecto.get(g)
            )}

          <section className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
              <h2 className="font-bold text-gray-900">Carga por día</h2>
              <div className="flex items-center gap-3 text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 bg-green-200 inline-block rounded" /> 1 actividad
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 bg-amber-300 inline-block rounded" /> 2
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 bg-red-400 inline-block rounded" /> 3 o más
                </span>
              </div>
            </div>
            <div className="overflow-auto">
              <table className="text-[10px] border-collapse">
                <thead>
                  <tr>
                    <th className="sticky left-0 bg-white border px-2 min-w-[180px]" rowSpan={2} />
                    {gruposSprint.map((g, i) => (
                      <th key={`${g.label}-${i}`} colSpan={g.cantidad} className="border bg-green-100 text-green-900 px-1 py-1 font-semibold">
                        {g.label}
                      </th>
                    ))}
                  </tr>
                  <tr>
                    {columnas.map((c) => (
                      <th
                        key={c.fecha}
                        className={`border px-0.5 py-1 font-semibold min-w-[30px] ${c.fecha === hoy ? 'bg-yellow-300' : 'bg-slate-50'}`}
                        title={formatFechaCorta(c.fecha)}
                      >
                        {c.etiqueta}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {resultado.personas.map((p) => (
                    <tr key={p.clave}>
                      <td className="sticky left-0 bg-white border px-2 py-1 whitespace-nowrap text-xs">{nombrePersona(p)}</td>
                      {columnas.map((c) => {
                        const acts = p.cargaPorFecha.get(c.fecha) ?? [];
                        return (
                          <td
                            key={c.fecha}
                            title={acts.length ? `${formatFechaCorta(c.fecha)}\n${acts.join('\n')}` : undefined}
                            className={`border text-center font-semibold h-6 ${colorCarga(acts.length)} ${
                              c.fecha === hoy ? 'outline outline-2 outline-orange-400' : ''
                            }`}
                          >
                            {acts.length || ''}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-gray-400 mt-2">Pasá el mouse sobre un día para ver las actividades.</p>
          </section>
        </>
      )}
    </div>
  );
};

export default CargaEquipoVista;
