// components/FormularioImportarPlanExterno.tsx
// Importa un Plan de Trabajo externo (formato de célula, no el que exporta
// esta app): el usuario elige el archivo, se listan sus hojas (leído en
// el navegador con exceljs, sin subir nada todavía), elige la hoja, y
// recién ahí se sube al servidor para matchear por código de HU y marcar
// el planificado.

'use client';

import { useState } from 'react';

interface Props {
  endpoint: string;
  onSuccess: () => void;
}

interface Resultado {
  filasConCodigo: number;
  huEncontradas: number;
  codigosNoEncontrados: string[];
  marcasAgregadas: number;
  marcasQuitadas: number;
  marcasSinCambios: number;
  errores: string[];
}

const FormularioImportarPlanExterno = ({ endpoint, onSuccess }: Props) => {
  const [archivo, setArchivo] = useState<File | null>(null);
  const [hojas, setHojas] = useState<string[]>([]);
  const [hojaElegida, setHojaElegida] = useState('');
  const [leyendoHojas, setLeyendoHojas] = useState(false);
  const [importando, setImportando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<Resultado | null>(null);

  const handleArchivo = async (f: File | null) => {
    setArchivo(f);
    setHojas([]);
    setHojaElegida('');
    setResultado(null);
    setError(null);
    if (!f) return;

    setLeyendoHojas(true);
    try {
      const ExcelJS = (await import('exceljs')).default;
      const buffer = await f.arrayBuffer();
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer);
      const nombres = workbook.worksheets.map((w) => w.name);
      setHojas(nombres);
      if (nombres.length > 0) setHojaElegida(nombres[0]);
    } catch (err) {
      setError('No se pudo leer el archivo — ¿es un .xlsx válido?');
    } finally {
      setLeyendoHojas(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!archivo || !hojaElegida) return;
    setImportando(true);
    setError(null);
    setResultado(null);
    try {
      const formData = new FormData();
      formData.append('archivo', archivo);
      formData.append('hoja', hojaElegida);
      const res = await fetch(endpoint, { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al importar el plan de trabajo');
      setResultado(data.data);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setImportando(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        Subí el Excel del plan de trabajo (formato de célula: Mes/Sprint/Día en el encabezado, actividades con código{' '}
        <strong>CF-NNN</strong> en el texto). Se matchea por código contra las HU ya cargadas en este proyecto — las
        que no tengan el mismo código no se van a poder marcar.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded text-sm">{error}</div>}

        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">Archivo (.xlsx) del plan de trabajo</label>
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={(e) => handleArchivo(e.target.files?.[0] || null)}
            className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2"
          />
        </div>

        {leyendoHojas && <p className="text-xs text-gray-400">Leyendo hojas del archivo...</p>}

        {hojas.length > 0 && (
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Hoja a importar</label>
            <select
              value={hojaElegida}
              onChange={(e) => setHojaElegida(e.target.value)}
              className="w-full text-sm px-3 py-2 border border-gray-300 rounded-lg bg-white"
            >
              {hojas.map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </select>
          </div>
        )}

        <button
          type="submit"
          disabled={importando || !archivo || !hojaElegida}
          className="w-full px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 font-semibold transition-colors"
        >
          {importando ? '⏳ Importando...' : '📥 Importar planificado'}
        </button>
      </form>

      {resultado && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-sm space-y-2">
          <p className="font-semibold text-green-800">
            ✓ {resultado.huEncontradas} de {resultado.filasConCodigo} HU del Excel matchearon por código — {resultado.marcasAgregadas}{' '}
            marca(s) agregada(s), {resultado.marcasQuitadas} quitada(s), {resultado.marcasSinCambios} sin cambios.
          </p>

          {resultado.codigosNoEncontrados.length > 0 && (
            <div className="text-amber-700">
              <p className="font-semibold">
                {resultado.codigosNoEncontrados.length} código(s) del Excel no se encontraron en la estructura de este
                proyecto (revisá que la HU exista con ese mismo código):
              </p>
              <p className="mt-1 font-mono text-xs">{resultado.codigosNoEncontrados.join(', ')}</p>
            </div>
          )}

          {resultado.errores.length > 0 && (
            <div className="text-red-700">
              <p className="font-semibold">Avisos / errores:</p>
              <ul className="list-disc list-inside max-h-40 overflow-y-auto">
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

export default FormularioImportarPlanExterno;
