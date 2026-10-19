import { useEffect, useId, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';

/**
 * Desplegable de filtro con la paleta de la app.
 *
 * El `<select>` nativo pinta su lista con los colores del sistema
 * operativo (fondo gris y resaltado azul), que no tienen nada que ver con
 * la marca. Este componente lo reemplaza por un panel propio: fondo de la
 * tarjeta, borde suave y la opción activa en ámbar.
 *
 * props:
 *   label     texto fijo que antecede al valor ("Pedido", "Crédito"...)
 *   value     opción seleccionada; cadena vacía = "Todos"
 *   options   lista de cadenas
 *   onChange  se llama con la opción elegida
 *   allLabel  texto de la opción que limpia el filtro
 *   icon      icono opcional a la izquierda del botón
 *   subtle    variante de menor contraste, para la barra fija
 *   multiple  permite marcar varias opciones a la vez; entonces `value` es
 *             un arreglo y el panel no se cierra al elegir
 */
export default function Dropdown({
  label,
  value = '',
  options = [],
  onChange,
  allLabel = 'Todos',
  icon = null,
  subtle = false,
  multiple = false,
}) {
  const [abierto, setAbierto] = useState(false);
  const contenedor = useRef(null);
  const listaId = useId();

  // ---- Cerrar al hacer click fuera o al presionar Escape ---------------
  useEffect(() => {
    if (!abierto) return undefined;

    const alClickFuera = (e) => {
      if (!contenedor.current?.contains(e.target)) setAbierto(false);
    };
    const alTeclear = (e) => {
      if (e.key === 'Escape') setAbierto(false);
    };

    document.addEventListener('pointerdown', alClickFuera);
    document.addEventListener('keydown', alTeclear);
    return () => {
      document.removeEventListener('pointerdown', alClickFuera);
      document.removeEventListener('keydown', alTeclear);
    };
  }, [abierto]);

  // En modo múltiple el valor es un arreglo y el panel queda abierto para
  // poder marcar varias opciones seguidas.
  const seleccionadas = multiple ? value ?? [] : [];
  const estaMarcada = (opcion) => (multiple ? seleccionadas.includes(opcion) : opcion === value);

  const elegir = (opcion) => {
    if (!multiple) {
      onChange(opcion);
      setAbierto(false);
      return;
    }
    onChange(
      seleccionadas.includes(opcion)
        ? seleccionadas.filter((v) => v !== opcion)
        : [...seleccionadas, opcion],
    );
  };

  const limpiar = () => {
    onChange(multiple ? [] : '');
    if (!multiple) setAbierto(false);
  };

  const activo = multiple ? seleccionadas.length > 0 : Boolean(value);

  // Texto del botón: "Todos", la opción elegida o "N seleccionados"
  const resumen = multiple
    ? seleccionadas.length === 0
      ? allLabel
      : seleccionadas.length === 1
        ? seleccionadas[0]
        : `${seleccionadas.length} seleccionados`
    : value || allLabel;

  // La variante "subtle" se usa en la barra fija del portal, donde el
  // control no debe competir con las cartas.
  const botonBase = subtle
    ? 'border-slate-200/70 bg-white/70 dark:border-white/5 dark:bg-brand-navy-800/60'
    : 'border-slate-200 bg-white dark:border-white/10 dark:bg-brand-navy-800';

  const botonActivo = 'border-amber-400 bg-amber-400/10 text-amber-600 dark:text-amber-400';

  return (
    <div ref={contenedor} className="relative">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={abierto}
        aria-controls={listaId}
        className={`flex items-center gap-1.5 rounded-lg border py-2 pl-2.5 pr-2 text-xs font-medium transition-colors ${
          activo ? botonActivo : `${botonBase} text-slate-600 dark:text-slate-300`
        }`}
      >
        {icon}
        <span className="whitespace-nowrap">
          {label}: {resumen}
        </span>
        <ChevronDown
          size={14}
          className={`shrink-0 opacity-70 transition-transform duration-200 ${abierto ? 'rotate-180' : ''}`}
        />
      </button>

      {abierto && (
        <ul
          id={listaId}
          role="listbox"
          aria-label={label}
          className="absolute left-0 top-full z-30 mt-1.5 max-h-64 min-w-[11rem] overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-xl shadow-slate-900/10 dark:border-white/10 dark:bg-brand-navy-800 dark:shadow-black/40"
        >
          {/* Opción que limpia el filtro */}
          <li>
            <button
              type="button"
              role="option"
              aria-selected={!activo}
              onClick={limpiar}
              className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-xs font-medium transition-colors ${
                !activo
                  ? 'bg-amber-400/15 text-amber-600 dark:text-amber-400'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/5'
              }`}
            >
              {allLabel}
              {!activo && <Check size={13} className="shrink-0" />}
            </button>
          </li>

          {/* Separador entre "Todos" y el catálogo */}
          <li aria-hidden="true" className="my-1 h-px bg-slate-100 dark:bg-white/10" />

          {options.map((opcion) => {
            const seleccionada = estaMarcada(opcion);
            return (
              <li key={opcion}>
                <button
                  type="button"
                  role="option"
                  aria-selected={seleccionada}
                  onClick={() => elegir(opcion)}
                  className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-xs font-medium transition-colors ${
                    seleccionada
                      ? 'bg-amber-400/15 text-amber-600 dark:text-amber-400'
                      : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/5'
                  }`}
                >
                  <span className="truncate">{opcion}</span>
                  {seleccionada && <Check size={13} className="shrink-0" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
