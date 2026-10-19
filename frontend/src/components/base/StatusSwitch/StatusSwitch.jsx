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
 *   onChange  se llama con el nuevo valor; si falta, queda de solo lectura
 */
export default function StatusSwitch({ value, options = ['Activo', 'Inactivo'], onChange, label = 'Estado' }) {
  const [encendido, apagado] = options;
  const activo = value === encendido;

  // ---- Solo lectura: se pinta como una pastilla, sin interacción -------
  if (!onChange) {
    return (
      <span
        className={`inline-flex items-center gap-2 text-xs font-semibold ${
          activo ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
        }`}
      >
        <span className={`h-2 w-2 rounded-full ${activo ? 'bg-emerald-500' : 'bg-red-500'}`} />
        {value}
      </span>
    );
  }

  // ---- Editable: interruptor con la etiqueta del estado al lado --------
  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        role="switch"
        aria-checked={activo}
        aria-label={label}
        title={`Cambiar a ${activo ? apagado : encendido}`}
        onClick={() => onChange(activo ? apagado : encendido)}
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
      <span
        className={`text-xs font-semibold ${
          activo ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
        }`}
      >
        {value}
      </span>
    </span>
  );
}
