import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/** Espera antes de mostrarse, para que no parpadee al pasar el mouse de largo. */
const ESPERA_MS = 150;

/**
 * Tooltip propio (con el estilo de la app) para los iconos: aparece al pasar
 * el mouse o al llegar con el teclado (Tab), arriba del elemento.
 *
 *   <Tooltip texto="Quitar esta foto"><button>…</button></Tooltip>
 *
 * Se pinta en un portal con posición fija, así ninguna tabla ni tarjeta con
 * overflow lo recorta. Un botón deshabilitado no recibe eventos del mouse,
 * por eso los escucha el contenedor (el botón lleva pointer-events-none).
 */
export default function Tooltip({ texto, children, className = '' }) {
  const ancla = useRef(null);
  const espera = useRef(null);
  const [posicion, setPosicion] = useState(null);

  const mostrar = () => {
    clearTimeout(espera.current);
    espera.current = setTimeout(() => {
      const r = ancla.current?.getBoundingClientRect();
      if (r) setPosicion({ x: r.left + r.width / 2, y: r.top });
    }, ESPERA_MS);
  };
  const ocultar = () => {
    clearTimeout(espera.current);
    setPosicion(null);
  };

  if (!texto) return children;

  return (
    <span
      ref={ancla}
      onMouseEnter={mostrar}
      onMouseLeave={ocultar}
      onFocus={mostrar}
      onBlur={ocultar}
      className={`inline-flex ${className}`}
    >
      {children}
      {posicion &&
        createPortal(
          <span
            role="tooltip"
            style={{ left: posicion.x, top: posicion.y }}
            className="pointer-events-none fixed z-[70] max-w-[16rem] -translate-x-1/2 -translate-y-[calc(100%+8px)] rounded-lg bg-brand-navy-900 px-2.5 py-1.5 text-center text-[11px] font-medium leading-snug text-white shadow-lg ring-1 ring-white/10 dark:bg-slate-100 dark:text-slate-900"
          >
            {texto}
            <span className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-brand-navy-900 dark:border-t-slate-100" />
          </span>,
          document.body,
        )}
    </span>
  );
}
