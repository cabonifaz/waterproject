// components/ModuloSeccion.tsx

'use client';

import { useState } from 'react';
import Modal from './Modal';
import FormularioNombreSimple from './FormularioNombreSimple';
import FormularioImportarExcel from './FormularioImportarExcel';
import EpicaSeccion from './EpicaSeccion';
import { ModuloConEpicas, Miembro } from '@/types';

interface Props {
  modulo: ModuloConEpicas;
  miembrosProyecto: Miembro[];
  totalGeneral: number;
  onRefrescar: () => void;
}

const ModuloSeccion = ({ modulo, miembrosProyecto, totalGeneral, onRefrescar }: Props) => {
  const [mostrarForm, setMostrarForm] = useState(false);
  const [mostrarImportar, setMostrarImportar] = useState(false);
  const [expandido, setExpandido] = useState(true);

  return (
    <div className="ml-4 mt-3 rounded-lg overflow-hidden border border-indigo-200">
      <div className="flex justify-between items-center px-3 py-2 bg-indigo-200">
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
        </div>
      </div>

      {expandido && (
        <div className="bg-indigo-50 p-3">
          {modulo.epicas.length === 0 && (
            <p className="ml-4 text-xs text-gray-400">Sin épicas / funcionalidades todavía</p>
          )}

          {modulo.epicas.map((epica) => (
            <EpicaSeccion
              key={epica.id}
              epica={epica}
              miembrosProyecto={miembrosProyecto}
              totalGeneral={totalGeneral}
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

      {mostrarImportar && (
        <Modal titulo="Importar Épicas / Funcionalidades y HU desde Excel" onClose={() => setMostrarImportar(false)}>
          <FormularioImportarExcel moduloId={modulo.id} onSuccess={onRefrescar} />
        </Modal>
      )}
    </div>
  );
};

export default ModuloSeccion;
