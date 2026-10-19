import { TriangleAlert } from 'lucide-react';

/**
 * Recuadro rojo con un mensaje de error (por ejemplo, el que devuelve la
 * API al rechazar un formulario). Si no hay mensaje, no muestra nada.
 */
export default function AvisoError({ mensaje, className = '' }) {
  if (!mensaje) return null;
  return (
    <p
      role="alert"
      className={`flex items-start gap-2 rounded-xl border border-red-400/40 bg-red-500/5 px-4 py-3 text-xs font-medium text-red-600 dark:text-red-400 ${className}`}
    >
      <TriangleAlert size={14} className="mt-px shrink-0" />
      <span>{mensaje}</span>
    </p>
  );
}
