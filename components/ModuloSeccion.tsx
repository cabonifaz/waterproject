// components/ModuloSeccion.tsx

'use client';

import { useState } from 'react';
import Modal from './Modal';
import FormularioNombreSimple from './FormularioNombreSimple';
import FormularioImportarExcel from './FormularioImportarExcel';
import EpicaSeccion from './EpicaSeccion';
import BotonesOrden from './BotonesOrden';
import { ModuloConEpicas, Miembro } from '@/types';

interface Props {
  modulo: ModuloConEpicas;
  miembrosProyecto: Miembro[];
  totalGeneral: number;
  idsHermanos: number[]; // módulos de la etapa, en orden — para ▲▼
  indice: number;
  onRefrescar: () => void;
}

const ModuloSeccion = ({ modulo, miembrosProyecto, totalGeneral, idsHermanos, indice, onRefrescar }: Props) => {
  const [mostrarForm, setMostrarForm] = useState(false);
  const [mostrarImportar, setMostrarImportar] = useState(false);
  const [editando, setEditando] = useState(false);
  const [expandido, setExpandido] = useState(true);
  const [agregandoCierre, setAgregandoCierre] = useState(false);
  // El bloque "Cierre del módulo" siempre va al final: no entra en el ▲▼.
  const idsEpicas = modulo.epicas.filter((e) => !e.es_cierre_modulo).map((e) => e.id);
  const tieneCierre = modulo.epicas.some((e) => e.es_cierre_modulo);

  const handleAgregarCierre = async () => {
    setAgregandoCierre(true);
    try {
      const res = await fetch(`/api/modulos/${modulo.id}/cierre`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'No se pudo agregar el cierre del módulo');
      setExpandido(true);
      onRefrescar();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'No se pudo agregar el cierre del módulo');
    } finally {
      setAgregandoCierre(false);
    }
  };

  return (
    <div className="ml-4 mt-3 rounded-lg overflow-hidden border border-indigo-200">
      <div className="flex justify-between items-center px-3 py-2 bg-indigo-200 gap-2">
        <BotonesOrden tipo="modulo" ids={idsHermanos} indice={indice} onMovido={onRefrescar} />
        <button onClick={() => setExpandido((v) => !v)} className="flex-1 text-left">
          <h3 className="font-bold text-indigo-900 text-sm">
            {expandido ? '▼' : '▶'} 📦 {modulo.nombre}
          </h3>
        </button>
        <div className="flex gap-3 flex-shrink-0">
          <button
            onClick={() => setMostrarImportar(true)}
            className="text-xs text-indigo-800 hover:text-indigo-950 font-semibold"
          >
            📥 Importar Excel
          </button>
          <button
            onClick={() => setMostrarForm(true)}
            className="text-xs text-indigo-800 hover:text-indigo-950 font-semibold"
          >
            ➕ Épica / Funcionalidad
          </button>
          {!tieneCierre && (
            <button
              onClick={handleAgregarCierre}
              disabled={agregandoCierre}
              title="Agregar al final del módulo las actividades de cierre (Ethical Hacking, comités, pase a producción...). Se editan en 🏁 Act. de cierre."
              className="text-xs text-amber-800 hover:text-amber-950 font-semibold disabled:opacity-50"
            >
              {agregandoCierre ? '...' : '🏁 Cierre del módulo'}
            </button>
          )}
          <button
            onClick={() => setEditando(true)}
            title="Editar módulo"
            className="text-xs text-indigo-800 hover:text-indigo-950"
          >
            ✏️
          </button>
        </div>
      </div>

      {expandido && (
        <div className="bg-indigo-50 p-3">
          {modulo.epicas.length === 0 && (
            <p className="ml-4 text-xs text-gray-400">Sin épicas / funcionalidades todavía</p>
          )}

          {modulo.epicas.map((epica, i) => (
            <EpicaSeccion
              key={epica.id}
              epica={epica}
              miembrosProyecto={miembrosProyecto}
              totalGeneral={totalGeneral}
              idsHermanas={idsEpicas}
              indice={epica.es_cierre_modulo ? -1 : i}
              onRefrescar={onRefrescar}
            />
          ))}
        </div>
      )}

      {mostrarForm && (
        <Modal titulo="Nueva Épica / Funcionalidad" onClose={() => setMostrarForm(false)}>
          <FormularioNombreSimple
            endpoint="/api/epicas"
            parentField="modulo_id"
            parentId={modulo.id}
            labelNombre="Nombre de la épica / funcionalidad"
            onSuccess={() => {
              setMostrarForm(false);
              onRefrescar();
            }}
          />
        </Modal>
      )}

      {editando && (
        <Modal titulo="Editar Módulo" onClose={() => setEditando(false)}>
          <FormularioNombreSimple
            endpoint={`/api/modulos/${modulo.id}`}
            labelNombre="Nombre del módulo"
            valorInicial={modulo.nombre}
            onSuccess={() => {
              setEditando(false);
              onRefrescar();
            }}
          />
        </Modal>
      )}

      {mostrarImportar && (
        <Modal titulo="Importar Épicas / Funcionalidades y HU desde Excel" onClose={() => setMostrarImportar(false)}>
          <FormularioImportarExcel moduloId={modulo.id} onSuccess={onRefrescar} />
        </Modal>
      )}
    </div>
  );
};

export default ModuloSeccion;
