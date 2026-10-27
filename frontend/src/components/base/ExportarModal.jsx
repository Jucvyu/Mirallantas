import { useState } from 'react';
import { Download, FileSpreadsheet, FileText, Sheet } from 'lucide-react';
import AvisoError from './AvisoError';
import Modal from './Modal';
import { exportar } from '../../utils/exportar';

const OPCIONES = [
  { formato: 'pdf', titulo: 'PDF', detalle: 'Para imprimir o enviar', icono: FileText, color: 'text-red-500' },
  { formato: 'excel', titulo: 'Excel', detalle: 'Archivo .xlsx con formato', icono: FileSpreadsheet, color: 'text-emerald-600' },
  { formato: 'csv', titulo: 'CSV', detalle: 'Texto plano para otros programas', icono: Sheet, color: 'text-blue-500' },
];

/**
 * Modal de "Exportar": se elige PDF, Excel o CSV y se descarga el archivo.
 *
 *   <ExportarModal titulo="Clientes" resumen="24 registros" datos={() => ({ secciones })} onClose={…} />
 *
 * `datos` es una función: los datos se arman al elegir el formato (así
 * siempre salen los que se están viendo en ese momento).
 */
export default function ExportarModal({ titulo, resumen, datos, onClose }) {
  const [generando, setGenerando] = useState(null);
  const [error, setError] = useState('');

  const elegir = async (formato, cerrar) => {
    setGenerando(formato);
    setError('');
    try {
      await exportar(formato, { titulo, ...datos() });
      cerrar();
    } catch (e) {
      setError(e.message || 'No se pudo generar el archivo.');
    } finally {
      setGenerando(null);
    }
  };

  return (
    <Modal title={`Exportar ${titulo.toLowerCase()}`} subtitle={resumen} icon={<Download size={17} />} size="sm" onClose={onClose}>
      {(cerrar) => (
        <div className="space-y-3">
          <AvisoError mensaje={error} />
          {OPCIONES.map(({ formato, titulo: nombre, detalle, icono: Icono, color }) => (
            <button
              key={formato}
              type="button"
              disabled={Boolean(generando)}
              onClick={() => elegir(formato, cerrar)}
              className="flex w-full items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 text-left transition-colors hover:border-amber-400 hover:bg-amber-400/5 disabled:cursor-wait disabled:opacity-60 dark:border-white/10"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 dark:bg-white/5">
                <Icono size={20} className={color} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold text-slate-800 dark:text-slate-100">{nombre}</span>
                <span className="block text-xs text-slate-500 dark:text-slate-400">{detalle}</span>
              </span>
              <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                {generando === formato ? 'Generando…' : 'Descargar'}
              </span>
            </button>
          ))}
        </div>
      )}
    </Modal>
  );
}
