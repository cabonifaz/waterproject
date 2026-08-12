// lib/observacionesUI.ts
// Etiquetas y colores de estado de una observación, compartidos entre el
// modal del Gantt Real y la página de inventario — un solo lugar para que
// ambos se vean consistentes.

import { EstadoObservacion } from '@/types';

export const ESTADOS_OBSERVACION: EstadoObservacion[] = [
  'en_atencion',
  'en_analisis',
  'en_publicacion',
  're_test',
  'certificada',
];

export const ESTADO_LABEL: Record<EstadoObservacion, string> = {
  en_atencion: 'En atención',
  en_analisis: 'En análisis',
  en_publicacion: 'En publicación',
  re_test: 'Re-test',
  certificada: 'Certificada',
};

export const ESTADO_COLOR: Record<EstadoObservacion, string> = {
  en_atencion: 'bg-red-100 text-red-800 border-red-300',
  en_analisis: 'bg-amber-100 text-amber-800 border-amber-300',
  en_publicacion: 'bg-blue-100 text-blue-800 border-blue-300',
  re_test: 'bg-purple-100 text-purple-800 border-purple-300',
  certificada: 'bg-green-100 text-green-800 border-green-300',
};

export function formatFecha(fecha: string | Date): string {
  return new Date(fecha).toLocaleDateString('es', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function formatFechaHora(fecha: string | Date): string {
  return new Date(fecha).toLocaleString('es', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
