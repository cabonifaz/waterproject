// types/index.ts
// Tipos y interfaces: Proyecto -> Etapa -> (Modulo -> Epica -> HU) | TareaMatriz

export type Semaforo = 'verde' | 'amarillo' | 'rojo' | 'negro';

export interface Proyecto {
  id: number;
  nombre: string;
  descripcion?: string;
  fecha_inicio: Date;
  estado: 'activo' | 'pausado' | 'completado' | 'cancelado';
  estado_planificacion: 'abierto' | 'cerrado';
  baseline_capturado: boolean;
  created_at: Date;
  updated_at: Date;
  // Solo presentes cuando vienen del listado GET /api/proyectos (resumen
  // liviano de días planificados/reales, sin baseline).
  porcentajeCumplimiento?: number | null;
  semaforo?: Semaforo;
}

export interface Sprint {
  id: number;
  numero: number;
  tipo: 'priorizacion' | 'sprint';
  fecha_inicio: Date;
  fecha_fin: Date;
  created_at: Date;
}

export interface Feriado {
  id: number;
  fecha: Date;
  created_at: Date;
}

export interface Miembro {
  id: number;
  proyecto_id: number;
  nombre: string;
  iniciales: string;
  created_at: Date;
}

export interface Etapa {
  id: number;
  proyecto_id: number;
  nombre: string;
  tipo: 'desarrollo' | 'simple';
  orden: number;
  created_at: Date;
  updated_at: Date;
}

export interface Modulo {
  id: number;
  etapa_id: number;
  nombre: string;
  orden: number;
  created_at: Date;
  updated_at: Date;
}

export interface Epica {
  id: number;
  modulo_id: number;
  nombre: string;
  orden: number;
  created_at: Date;
  updated_at: Date;
}

export interface HistoriaUsuario {
  id: number;
  epica_id: number;
  codigo?: string;
  titulo: string;
  descripcion?: string;
  responsable?: string;
  prioridad: 'baja' | 'media' | 'alta';
  dias_desarrollo: number;
  dias_certificacion: number;
  cerrada: boolean;
  fecha_cierre?: Date;
  orden: number;
  created_at: Date;
  updated_at: Date;
}

export interface TareaMatriz {
  id: number;
  etapa_id: number;
  titulo: string;
  descripcion?: string;
  responsable?: string;
  dias_estimados: number;
  completada: boolean;
  orden: number;
  created_at: Date;
  updated_at: Date;
}

// ========================================
// DÍAS PLANIFICADOS (marcado del Gantt)
// ========================================

export type TipoMarcaHU = 'desarrollo' | 'certificacion' | 'cierre';
export type TipoMarcaTareaMatriz = 'trabajo' | 'cierre';

export interface DiaPlanificadoHU {
  fecha: string; // yyyy-mm-dd
  tipo_marca: TipoMarcaHU;
}

export interface DiaPlanificadoTareaMatriz {
  fecha: string;
  tipo_marca: TipoMarcaTareaMatriz;
}

// ========================================
// ÁRBOL DE ESTRUCTURA COMPLETA DE UN PROYECTO
// ========================================

export interface HistoriaUsuarioConDias extends HistoriaUsuario {
  diasPlanificados: DiaPlanificadoHU[];
  diasReales: DiaPlanificadoHU[];
  diasBaseline: DiaPlanificadoHU[];
  miembros: Miembro[];
}

export interface TareaMatrizConDias extends TareaMatriz {
  diasPlanificados: DiaPlanificadoTareaMatriz[];
  diasReales: DiaPlanificadoTareaMatriz[];
  diasBaseline: DiaPlanificadoTareaMatriz[];
  miembros: Miembro[];
}

export interface EpicaConHU extends Epica {
  historias: HistoriaUsuarioConDias[];
}

export interface ModuloConEpicas extends Modulo {
  epicas: EpicaConHU[];
}

export interface EtapaConContenido extends Etapa {
  tareasMatrices: TareaMatrizConDias[];
  modulos: ModuloConEpicas[];
}

export interface EstructuraProyecto {
  proyecto: Proyecto;
  etapas: EtapaConContenido[];
  miembros: Miembro[];
}

// ========================================
// AVANCE CÉLULA (reporte real vs. planificado vs. baseline)
// ========================================

export interface CorteAvance {
  id: number;
  proyecto_id: number;
  fecha_corte: string;
  created_at: Date;
}

export interface DetalleCorteAvance {
  id: number;
  corte_id: number;
  tipo: 'etapa' | 'epica' | 'tarea_matriz';
  referencia_id: number;
  etapa_nombre: string;
  nombre: string;
  orden: number;
  dias_totales: number;
  dias_planificados: number;
  dias_reales: number;
}

export interface FilaAvanceCedula {
  tipo: 'etapa' | 'epica' | 'tarea_matriz';
  referenciaId: number;
  etapaNombre: string;
  nombre: string;
  esEncabezadoEtapa: boolean;
  diasTotales: number;
  diasPlanificados: number;
  diasReales: number;
}

// ========================================
// RESPUESTAS DE API
// ========================================

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: Date;
}
