// lib/services/estructuraService.ts
// Compone el árbol completo de un proyecto (etapas -> tareas matrices +
// módulos -> épicas -> HU) en una sola llamada, para que el frontend no
// tenga que hacer N+1 peticiones.

import * as proyectosService from './proyectosService';
import * as etapasService from './etapasService';
import * as modulosService from './modulosService';
import * as epicasService from './epicasService';
import * as historiasUsuarioService from './historiasUsuarioService';
import * as tareasMatricesService from './tareasMatricesService';
import * as diasPlanificadosService from './diasPlanificadosService';
import * as diasRealesService from './diasRealesService';
import * as baselineService from './baselineService';
import * as miembrosService from './miembrosService';
import {
  EstructuraProyecto,
  EtapaConContenido,
  ModuloConEpicas,
  EpicaConHU,
  DiaPlanificadoHU,
  DiaPlanificadoTareaMatriz,
  Miembro,
} from '@/types';

export async function obtenerEstructuraProyecto(proyectoId: number): Promise<EstructuraProyecto | null> {
  const proyecto = await proyectosService.obtenerProyecto(proyectoId);
  if (!proyecto) return null;

  const [
    etapas,
    diasHUCrudos,
    diasTMCrudos,
    diasHURealCrudos,
    diasTMRealCrudos,
    diasHUBaselineCrudos,
    diasTMBaselineCrudos,
    miembros,
    asignacionesHUCrudas,
    asignacionesTMCrudas,
  ] = await Promise.all([
    etapasService.listarEtapasProyecto(proyectoId),
    diasPlanificadosService.listarDiasHUProyecto(proyectoId),
    diasPlanificadosService.listarDiasTareaMatrizProyecto(proyectoId),
    diasRealesService.listarDiasHURealProyecto(proyectoId),
    diasRealesService.listarDiasTareaMatrizRealProyecto(proyectoId),
    baselineService.listarDiasHUBaselineProyecto(proyectoId),
    baselineService.listarDiasTareaMatrizBaselineProyecto(proyectoId),
    miembrosService.listarMiembrosProyecto(proyectoId),
    miembrosService.listarAsignacionesHUProyecto(proyectoId),
    miembrosService.listarAsignacionesTareaMatrizProyecto(proyectoId),
  ]);

  const miembrosPorId = new Map<number, Miembro>();
  for (const m of miembros) miembrosPorId.set(m.id, m);

  const diasPorHU = new Map<number, DiaPlanificadoHU[]>();
  for (const d of diasHUCrudos) {
    const lista = diasPorHU.get(d.historia_usuario_id) || [];
    lista.push({ fecha: d.fecha, tipo_marca: d.tipo_marca });
    diasPorHU.set(d.historia_usuario_id, lista);
  }

  const diasPorTM = new Map<number, DiaPlanificadoTareaMatriz[]>();
  for (const d of diasTMCrudos) {
    const lista = diasPorTM.get(d.tarea_matriz_id) || [];
    lista.push({ fecha: d.fecha, tipo_marca: d.tipo_marca });
    diasPorTM.set(d.tarea_matriz_id, lista);
  }

  const diasRealesPorHU = new Map<number, DiaPlanificadoHU[]>();
  for (const d of diasHURealCrudos) {
    const lista = diasRealesPorHU.get(d.historia_usuario_id) || [];
    lista.push({ fecha: d.fecha, tipo_marca: d.tipo_marca });
    diasRealesPorHU.set(d.historia_usuario_id, lista);
  }

  const diasRealesPorTM = new Map<number, DiaPlanificadoTareaMatriz[]>();
  for (const d of diasTMRealCrudos) {
    const lista = diasRealesPorTM.get(d.tarea_matriz_id) || [];
    lista.push({ fecha: d.fecha, tipo_marca: d.tipo_marca });
    diasRealesPorTM.set(d.tarea_matriz_id, lista);
  }

  const diasBaselinePorHU = new Map<number, DiaPlanificadoHU[]>();
  for (const d of diasHUBaselineCrudos) {
    const lista = diasBaselinePorHU.get(d.historia_usuario_id) || [];
    lista.push({ fecha: d.fecha, tipo_marca: d.tipo_marca });
    diasBaselinePorHU.set(d.historia_usuario_id, lista);
  }

  const diasBaselinePorTM = new Map<number, DiaPlanificadoTareaMatriz[]>();
  for (const d of diasTMBaselineCrudos) {
    const lista = diasBaselinePorTM.get(d.tarea_matriz_id) || [];
    lista.push({ fecha: d.fecha, tipo_marca: d.tipo_marca });
    diasBaselinePorTM.set(d.tarea_matriz_id, lista);
  }

  const miembrosPorHU = new Map<number, Miembro[]>();
  for (const a of asignacionesHUCrudas) {
    const miembro = miembrosPorId.get(a.miembro_id);
    if (!miembro) continue;
    const lista = miembrosPorHU.get(a.historia_usuario_id) || [];
    lista.push(miembro);
    miembrosPorHU.set(a.historia_usuario_id, lista);
  }

  const miembrosPorTM = new Map<number, Miembro[]>();
  for (const a of asignacionesTMCrudas) {
    const miembro = miembrosPorId.get(a.miembro_id);
    if (!miembro) continue;
    const lista = miembrosPorTM.get(a.tarea_matriz_id) || [];
    lista.push(miembro);
    miembrosPorTM.set(a.tarea_matriz_id, lista);
  }

  const etapasConContenido: EtapaConContenido[] = await Promise.all(
    etapas.map(async (etapa): Promise<EtapaConContenido> => {
      const [tareasMatricesRaw, modulos] = await Promise.all([
        tareasMatricesService.listarTareasMatricesEtapa(etapa.id),
        modulosService.listarModulosEtapa(etapa.id),
      ]);

      const tareasMatrices = tareasMatricesRaw.map((t) => ({
        ...t,
        diasPlanificados: diasPorTM.get(t.id) || [],
        diasReales: diasRealesPorTM.get(t.id) || [],
        diasBaseline: diasBaselinePorTM.get(t.id) || [],
        miembros: miembrosPorTM.get(t.id) || [],
      }));

      const modulosConEpicas: ModuloConEpicas[] = await Promise.all(
        modulos.map(async (modulo): Promise<ModuloConEpicas> => {
          const epicas = await epicasService.listarEpicasModulo(modulo.id);

          const epicasConHU: EpicaConHU[] = await Promise.all(
            epicas.map(async (epica): Promise<EpicaConHU> => {
              const historiasRaw = await historiasUsuarioService.listarHUEpica(epica.id);
              const historias = historiasRaw.map((h) => ({
                ...h,
                diasPlanificados: diasPorHU.get(h.id) || [],
                diasReales: diasRealesPorHU.get(h.id) || [],
                diasBaseline: diasBaselinePorHU.get(h.id) || [],
                miembros: miembrosPorHU.get(h.id) || [],
              }));
              return { ...epica, historias };
            })
          );

          return { ...modulo, epicas: epicasConHU };
        })
      );

      return { ...etapa, tareasMatrices, modulos: modulosConEpicas };
    })
  );

  return { proyecto, etapas: etapasConContenido, miembros };
}
