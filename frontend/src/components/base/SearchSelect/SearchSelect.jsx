import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search } from 'lucide-react';
import { BORDER_ERR, BORDER_OK, INPUT } from '../formStyles';

/**
 * Selector con buscador para catálogos largos.
 *
 * Los `<select>` con decenas de opciones son incómodos de recorrer, así que
 * a partir de cierto tamaño (ver `Field.jsx`) los formularios usan este
 * componente: mismo aspecto que el campo normal, pero al abrirlo aparece
 * una barra de búsqueda que filtra las opciones.
 */
export default function SearchSelect({ value, options = [], onChange, placeholder = 'Seleccionar...', error }) {
  const [abierto, setAbierto] = useState(false);
  const [query, setQuery] = useState('');
  const contenedor = useRef(null);
  const buscador = useRef(null);

  // Cerrar al hacer click fuera o con Escape
  useEffect(() => {
    if (!abierto) return undefined;
    const alClickFuera = (e) => {
      if (!contenedor.current?.contains(e.target)) setAbierto(false);
    };
    const alTeclear = (e) => e.key === 'Escape' && setAbierto(false);
    document.addEventListener('pointerdown', alClickFuera);
    document.addEventListener('keydown', alTeclear);
    return () => {
      document.removeEventListener('pointerdown', alClickFuera);
      document.removeEventListener('keydown', alTeclear);
    };
  }, [abierto]);

  // El foco cae en el buscador apenas se abre
  useEffect(() => {
    if (abierto) buscador.current?.focus();
  }, [abierto]);

  const filtradas = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((o) => String(o).toLowerCase().includes(q)) : options;
  }, [options, query]);

  const elegir = (opcion) => {
    onChange(opcion);
    setAbierto(false);
    setQuery('');
  };

  return (
    <div ref={contenedor} className="relative">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={abierto}
        className={`${INPUT} ${error ? BORDER_ERR : BORDER_OK} flex items-center justify-between gap-2 text-left ${
          value ? '' : 'text-slate-400 dark:text-slate-500'
        }`}
      >
        <span className="truncate">{value || placeholder}</span>
        <ChevronDown
          size={16}
          className={`shrink-0 text-slate-400 transition-transform duration-200 ${abierto ? 'rotate-180' : ''}`}
        />
      </button>

      {abierto && (
        <div className="absolute left-0 right-0 top-full z-30 mt-1.5 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl shadow-slate-900/10 dark:border-white/10 dark:bg-brand-navy-800 dark:shadow-black/40">
          {/* ---- Barra de búsqueda ---- */}
          <div className="relative border-b border-slate-100 p-2 dark:border-white/10">
            <Search size={14} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              ref={buscador}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar..."
              className={`${INPUT} ${BORDER_OK} py-1.5 pl-8 pr-3 text-xs`}
            />
          </div>

          <ul role="listbox" className="max-h-56 overflow-y-auto p-1">
            {filtradas.map((o) => {
              const activa = o === value;
              return (
                <li key={o}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={activa}
                    onClick={() => elegir(o)}
                    className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-xs font-medium transition-colors ${
                      activa
                        ? 'bg-amber-400/15 text-amber-600 dark:text-amber-400'
                        : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/5'
                    }`}
                  >
                    <span className="truncate">{o}</span>
                    {activa && <Check size={13} className="shrink-0" />}
                  </button>
                </li>
              );
            })}

            {filtradas.length === 0 && (
              <li className="px-3 py-6 text-center text-xs text-slate-400">Sin coincidencias.</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
