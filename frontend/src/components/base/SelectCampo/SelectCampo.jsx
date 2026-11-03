import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from 'lucide-react';
import { BORDER_ERR, BORDER_OK, INPUT } from '../formStyles';

/** Alto aproximado de una opción y máximo de la lista, para decidir si abre hacia arriba. */
const ALTO_OPCION = 36;
const ALTO_MAXIMO = 240;

/**
 * Desplegable de los formularios, con la paleta de la app. El <select> del
 * navegador pinta su lista con los colores del sistema y no se puede
 * estilizar de forma fiable.
 *
 *   <SelectCampo id="metodo" value={metodo} options={['Efectivo', 'Transferencia']} onChange={setMetodo} />
 *
 * La lista va en un portal con posición fija para que no la recorte el scroll
 * del modal, y abre hacia arriba si abajo no cabe. El foco se queda en el
 * botón: se maneja con flechas, Enter, Escape y Tab.
 */
export default function SelectCampo({ id, value, options = [], onChange, onBlur, error = false, placeholder = 'Seleccionar...' }) {
  const [abierto, setAbierto] = useState(false);
  const [resaltada, setResaltada] = useState(-1);
  const [posicion, setPosicion] = useState(null);
  const boton = useRef(null);
  const lista = useRef(null);
  const idLista = useId();

  const ubicar = () => {
    const caja = boton.current.getBoundingClientRect();
    const alto = Math.min(options.length * ALTO_OPCION + 8, ALTO_MAXIMO);
    const abajo = window.innerHeight - caja.bottom;
    const haciaArriba = abajo < alto + 8 && caja.top > abajo;
    setPosicion({
      left: caja.left,
      width: caja.width,
      ...(haciaArriba ? { bottom: window.innerHeight - caja.top + 6 } : { top: caja.bottom + 6 }),
    });
  };

  const abrir = () => {
    ubicar();
    setResaltada(options.indexOf(value));
    setAbierto(true);
  };

  const elegir = (opcion) => {
    onChange(opcion);
    setAbierto(false);
  };

  // Mientras está abierta: cerrar al hacer clic fuera y seguir al campo si algo se mueve
  useEffect(() => {
    if (!abierto) return undefined;
    const alClickFuera = (e) => {
      if (!boton.current?.contains(e.target) && !lista.current?.contains(e.target)) setAbierto(false);
    };
    const alMoverse = (e) => {
      if (!lista.current?.contains(e.target)) ubicar();
    };
    document.addEventListener('pointerdown', alClickFuera);
    window.addEventListener('scroll', alMoverse, true);
    window.addEventListener('resize', alMoverse);
    return () => {
      document.removeEventListener('pointerdown', alClickFuera);
      window.removeEventListener('scroll', alMoverse, true);
      window.removeEventListener('resize', alMoverse);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto, options.length]);

  const alTeclear = (e) => {
    if (e.key === 'Tab') {
      setAbierto(false);
      return;
    }
    if (!abierto) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
        e.preventDefault();
        abrir();
      }
      return;
    }
    if (e.key === 'Escape') {
      // Solo cierra la lista: que el modal no se cierre con ella
      e.stopPropagation();
      setAbierto(false);
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const paso = e.key === 'ArrowDown' ? 1 : -1;
      setResaltada((i) => (i + paso + options.length) % options.length);
    } else if ((e.key === 'Enter' || e.key === ' ') && resaltada >= 0) {
      e.preventDefault();
      elegir(options[resaltada]);
    }
  };

  return (
    <>
      <button
        id={id}
        ref={boton}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={abierto}
        aria-controls={abierto ? idLista : undefined}
        aria-activedescendant={abierto && resaltada >= 0 ? `${idLista}-${resaltada}` : undefined}
        aria-invalid={error}
        onClick={() => (abierto ? setAbierto(false) : abrir())}
        onKeyDown={alTeclear}
        onBlur={onBlur}
        className={`${INPUT} ${error ? BORDER_ERR : BORDER_OK} flex cursor-pointer items-center justify-between gap-2 text-left focus:border-amber-400 ${
          abierto ? 'ring-4 ring-amber-400/30' : ''
        }`}
      >
        <span className={`truncate ${value ? '' : 'font-normal text-slate-400 dark:text-slate-500'}`}>{value || placeholder}</span>
        <ChevronDown size={16} className={`shrink-0 text-slate-400 transition-transform duration-200 ${abierto ? 'rotate-180' : ''}`} />
      </button>

      {abierto &&
        posicion &&
        createPortal(
          <ul
            id={idLista}
            ref={lista}
            role="listbox"
            style={{ ...posicion, maxHeight: ALTO_MAXIMO, animation: 'ml-menu-in 160ms var(--ml-ease-out) both' }}
            className="ml-glass-panel fixed z-[70] overflow-y-auto rounded-xl border p-1"
          >
            {options.map((opcion, i) => {
              const activa = opcion === value;
              return (
                <li
                  key={opcion}
                  id={`${idLista}-${i}`}
                  role="option"
                  aria-selected={activa}
                  // El foco se queda en el botón, para no salir del modal
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setResaltada(i)}
                  onClick={() => elegir(opcion)}
                  className={`flex cursor-pointer items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    activa
                      ? 'bg-amber-400/15 text-amber-600 dark:text-amber-400'
                      : i === resaltada
                        ? 'bg-slate-100 text-slate-800 dark:bg-white/[0.07] dark:text-slate-100'
                        : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  <span className="truncate">{opcion}</span>
                  {activa && <Check size={14} className="shrink-0" />}
                </li>
              );
            })}
          </ul>,
          document.body,
        )}
    </>
  );
}
