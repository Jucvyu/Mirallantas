import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import LiquidGlass from '../LiquidGlass';

const SIZES = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

const TONES = {
  default: {
    chip: 'bg-amber-400/15 text-amber-500 dark:text-amber-400',
    rule: 'from-amber-400 via-amber-300 to-amber-400/0',
  },
  danger: {
    chip: 'bg-red-500/15 text-red-600 dark:text-red-400',
    rule: 'from-red-500 via-red-400 to-red-500/0',
  },
  info: {
    chip: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
    rule: 'from-blue-500 via-blue-400 to-blue-500/0',
  },
};

/**
 * Modal flotante de la app.
 *
 * - Desenfoca ("blur") el fondo mientras está abierto y lo devuelve a la
 *   normalidad con una animación de salida al cerrarse.
 * - Se cierra con Escape, con la X o haciendo click fuera del panel.
 * - Bloquea el scroll del body mientras está visible.
 *
 * props:
 *   title, subtitle, icon (nodo lucide), tone ('default'|'danger'|'info'),
 *   size ('sm'|'md'|'lg'|'xl'), footer (nodo), onClose, children
 */
export default function Modal({
  title,
  subtitle,
  icon = null,
  tone = 'default',
  size = 'md',
  footer = null,
  onClose,
  children,
}) {
  const [closing, setClosing] = useState(false);
  const t = TONES[tone] ?? TONES.default;
  const panel = useRef(null);
  // Lo que tenía el foco al abrir (se lee en el primer render, antes de que
  // un campo con autoFocus lo tome): al cerrar, el teclado vuelve ahí.
  const [previo] = useState(() => document.activeElement);

  // El teclado entra al modal al abrirlo. Si un campo ya tomó el foco
  // (autoFocus), se respeta.
  useEffect(() => {
    if (panel.current && !panel.current.contains(document.activeElement)) panel.current.focus();
  }, []);

  // Cerrar sólo marca el estado: primero corre la animación de salida.
  const requestClose = useCallback(() => setClosing(true), []);

  // Una vez terminada esa animación se desmonta de verdad.
  useEffect(() => {
    if (!closing) return undefined;
    const id = setTimeout(() => {
      if (previo instanceof HTMLElement && previo.isConnected) previo.focus();
      onClose?.();
    }, 180);
    return () => clearTimeout(id);
  }, [closing, onClose, previo]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        requestClose();
        return;
      }
      // El foco no sale del modal con Tab / Shift+Tab: da la vuelta dentro
      if (e.key !== 'Tab' || !panel.current) return;
      const enfocables = [
        ...panel.current.querySelectorAll(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ].filter((el) => el.offsetParent !== null);
      if (enfocables.length === 0) {
        e.preventDefault();
        return;
      }
      const primero = enfocables[0];
      const ultimo = enfocables[enfocables.length - 1];
      const dentro = panel.current.contains(document.activeElement);
      if (e.shiftKey && (document.activeElement === primero || !dentro)) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && (document.activeElement === ultimo || !dentro)) {
        e.preventDefault();
        primero.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [requestClose]);

  const anim = closing ? 'is-closing' : '';
  // El footer puede ser un nodo o una función que recibe el cierre animado.
  const footerNode = typeof footer === 'function' ? footer(requestClose) : footer;

  return createPortal(
    <div
      className={`ml-backdrop ${anim} fixed inset-0 z-50 flex items-center justify-center bg-brand-navy-950/35 p-4 dark:bg-brand-navy-950/65`}
      onMouseDown={(e) => e.target === e.currentTarget && requestClose()}
      role="presentation"
    >
      {/* Panel opaco (el formulario manda) con el reflejo de vidrio que sigue
          al cursor; sin inclinación para no mover lo que se está escribiendo */}
      <LiquidGlass
        ref={panel}
        variante="panel"
        inclinacion={0}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`ml-panel ${anim} flex max-h-[90vh] w-full ${SIZES[size] ?? SIZES.md} flex-col overflow-hidden rounded-2xl border focus:outline-none`}
      >
        {/* Filete de acento superior */}
        <div className={`h-[3px] w-full bg-gradient-to-r ${t.rule}`} />

        {(title || icon) && (
          <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-4 dark:border-white/10">
            <div className="flex items-center gap-3">
              {icon && (
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${t.chip}`}>
                  {icon}
                </span>
              )}
              <div>
                <h3 className="text-base font-bold leading-tight text-slate-900 dark:text-white">{title}</h3>
                {subtitle && (
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>
                )}
              </div>
            </div>
            <button
              onClick={requestClose}
              className="ml-pulsable -mr-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-slate-100"
              aria-label="Cerrar"
            >
              <X size={17} />
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>

        {footerNode && (
          <div className="flex items-center justify-end gap-2.5 border-t border-slate-200/80 bg-slate-50/70 px-6 py-4 dark:border-white/10 dark:bg-white/[0.03]">
            {footerNode}
          </div>
        )}
      </LiquidGlass>
    </div>,
    document.body,
  );
}
