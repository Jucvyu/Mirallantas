import Tooltip from '../Tooltip';
import { useProcesando } from '../../../hooks/useProcesando';

/**
 * Interruptor de estado para los listados binarios (Activo / Inactivo).
 *
 * Se usa en vez del `StatusSelect` cuando el catálogo del módulo tiene
 * exactamente dos valores: verde cuando está encendido, rojo cuando no.
 * Es un `<button role="switch">` nativo, así que funciona con teclado y
 * lectores de pantalla sin dependencias extra.
 *
 * props:
 *   value     valor actual (p. ej. 'Activo')
 *   options   [encendido, apagado] — el primero es el estado "activo"
 *   onChange  se llama con el nuevo valor; si falta, queda de solo lectura.
 *             Si devuelve una promesa (la petición a la API), mientras
 *             responde el interruptor se ve como un skeleton y no recibe
 *             más clics.
 */
export default function StatusSwitch({ value, options = ['Activo', 'Inactivo'], onChange, label = 'Estado' }) {
  const [encendido, apagado] = options;
  const activo = value === encendido;
  const [procesando, cambiar] = useProcesando(onChange);

  // ---- Solo lectura: se pinta como una pastilla, sin interacción -------
  if (!onChange) {
    return (
      <Tooltip texto={value}>
        <span className="inline-flex items-center" role="img" aria-label={`${label}: ${value}`}>
          <span className={`h-2.5 w-2.5 rounded-full ${activo ? 'bg-emerald-500' : 'bg-red-500'}`} />
        </span>
      </Tooltip>
    );
  }

  // ---- Procesando: skeleton del interruptor, sin clic -------------------
  if (procesando) {
    return (
      <span role="status" aria-label={`${label}: actualizando`} className="inline-flex cursor-wait">
        <span aria-hidden="true" className="block h-5 w-9 animate-pulse rounded-full bg-slate-200 dark:bg-white/10" />
        <span className="sr-only">Actualizando</span>
      </span>
    );
  }

  // ---- Editable: interruptor; el estado se lee en el tooltip ----------
  return (
    <Tooltip texto={value}>
      <button
        type="button"
        role="switch"
        aria-checked={activo}
        aria-label={`${label}: ${value}`}
        onClick={() => cambiar(activo ? apagado : encendido)}
        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:ring-offset-1 focus:ring-offset-white dark:focus:ring-offset-brand-navy-800 ${
          activo ? 'bg-emerald-500' : 'bg-red-500'
        }`}
      >
        <span
          className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
            activo ? 'translate-x-[1.15rem]' : 'translate-x-[0.15rem]'
          }`}
        />
      </button>
    </Tooltip>
  );
}
