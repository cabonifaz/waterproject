// components/FormularioImportarExcel.tsx
// Carga masiva de épicas + HU dentro de un módulo desde un archivo Excel.

'use client';

import { useState } from 'react';

interface Props {
  moduloId: number;
  onSuccess: () => void;
}

interface Resultado {
  epicasCreadas: number;
  epicasReusadas: number;
  huCreadas: number;
  errores: string[];
}

const FormularioImportarExcel = ({ moduloId, onSuccess }: Props) => {
  const [archivo, setArchivo] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<Resultado | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!archivo) return;
    setLoading(true);
    setError(null);
    setResultado(null);
    try {
      const formData = new FormData();
      formData.append('archivo', archivo);
      const res = await fetch(`/api/modulos/${moduloId}/importar-excel`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al importar el Excel');
      setResultado(data.data);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        Subí un Excel con las columnas <strong>Épica / Funcionalidad, Código, Título, Descripción, Prioridad</strong> — una fila
        por HU. Si repetís el nombre de la épica en varias filas, se agrupan todas bajo la misma épica.
      </p>

      <a
        href={`/api/modulos/${moduloId}/plantilla-excel`}
        className="inline-block text-sm text-blue-600 hover:text-blue-800 font-semibold"
      >
        ⬇️ Descargar plantilla de ejemplo
      </a>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded text-sm">{error}</div>}

        <input
          type="file"
          accept=".xlsx,.xls"
          onChange={(e) => setArchivo(e.target.files?.[0] || null)}
          className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2"
        />

        <button
          type="submit"
          disabled={loading || !archivo}
          className="w-full px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 font-semibold transition-colors"
        >
          {loading ? '⏳ Importando...' : '📥 Importar'}
        </button>
      </form>

      {resultado && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-sm space-y-1">
          <p className="font-semibold text-green-800">
            ✓ {resultado.epicasCreadas} épica(s) nueva(s), {resultado.epicasReusadas} reusada(s), {resultado.huCreadas}{' '}
            HU creada(s).
          </p>
          {resultado.errores.length > 0 && (
            <div className="text-red-700 mt-2">
              <p className="font-semibold">Filas con errores:</p>
              <ul className="list-disc list-inside">
                {resultado.errores.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default FormularioImportarExcel;
