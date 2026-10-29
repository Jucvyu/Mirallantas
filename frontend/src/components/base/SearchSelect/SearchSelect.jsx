import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Plus, Search, X } from 'lucide-react';
import { BORDER_ERR, BORDER_OK, INPUT } from '../formStyles';

/**
 * Selector con buscador: el campo ES la barra de búsqueda desde el inicio.
 * No hay un botón que abra otro campo aparte: se escribe directamente y la
 * lista aparece debajo filtrándose. Al elegir, el campo muestra la opción
 * (y su detalle, p. ej. el documento del cliente); al enfocarlo se puede
 * escribir de nuevo para buscar otra.
 *
 *   <SearchSelect value={id} options={[{ valor, etiqueta, detalle }]} onChange={setId} />
 *   <SearchSelect value="195/65R15" options={['195/65R15', …]} permitirNuevo onChange={…} />
 *
 * - Las opciones pueden ser textos o objetos { valor, etiqueta, detalle }.
 *   Con objetos se guarda el `valor` (p. ej. el id real del cliente) y se
 *   busca tanto en la etiqueta como en el detalle (p. ej. "CC 1020304050").
 * - `permitirNuevo`: si lo escrito no coincide con ninguna opción, ofrece
 *   usarlo como valor nuevo (p. ej. una medida que todavía no existe).
 */

/** Convierte un texto en opción con la misma forma que los objetos. */
const normalizar = (o) => (typeof o === 'object' && o !== null ? o : { valor: o, etiqueta: String(o) });

/** "195/65 r15" → "195/65R15": así se comparan las opciones escritas a mano. */
const clave = (texto) => String(texto ?? '').replace(/\s+/g, '').toUpperCase();

export default function SearchSelect({
  value,
  options = [],
  onChange,
  placeholder = 'Seleccionar...',
  placeholderBusqueda = 'Buscar...',
  error,
  permitirNuevo = false,
  id,
}) {
  const [abierto, setAbierto] = useState(false);
  const [query, setQuery] = useState('');
  const contenedor = useRef(null);
  const campo = useRef(null);
  const opciones = useMemo(() => options.map(normalizar), [options]);

  // Cerrar al hacer click fuera o con Escape
  useEffect(() => {
    if (!abierto) return undefined;
    const cerrarAhora = () => {
      setAbierto(false);
      setQuery('');
    };
    const alClickFuera = (e) => {
      if (!contenedor.current?.contains(e.target)) cerrarAhora();
    };
    const alTeclear = (e) => e.key === 'Escape' && cerrarAhora();
    document.addEventListener('pointerdown', alClickFuera);
    document.addEventListener('keydown', alTeclear);
    return () => {
      document.removeEventListener('pointerdown', alClickFuera);
      document.removeEventListener('keydown', alTeclear);
    };
  }, [abierto]);

  const elegida = opciones.find((o) => o.valor === value);
  const etiquetaElegida = elegida?.etiqueta ?? (permitirNuevo && value ? String(value) : '');

  const filtradas = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return opciones;
    return opciones.filter((o) => `${o.etiqueta} ${o.detalle ?? ''}`.toLowerCase().includes(q));
  }, [opciones, query]);

  // Lo escrito ya existe (sin importar mayúsculas ni espacios)
  const yaExiste = opciones.some((o) => clave(o.etiqueta) === clave(query));
  const ofrecerNuevo = permitirNuevo && query.trim() && !yaExiste;

  const abrir = () => {
    setAbierto(true);
    setQuery('');
  };
  const cerrar = () => {
    setAbierto(false);
    setQuery('');
  };

  const elegir = (valor) => {
    onChange(valor);
    cerrar();
    campo.current?.blur();
  };

  // Cuando está abierto el campo muestra lo que se escribe; cerrado, la opción elegida
  const valorCampo = abierto ? query : etiquetaElegida;

  return (
    <div ref={contenedor} className="relative">
      <div className="relative">
        <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          id={id}
          ref={campo}
          type="text"
          role="combobox"
          aria-expanded={abierto}
          aria-autocomplete="list"
          autoComplete="off"
          value={valorCampo}
          onFocus={abrir}
          onChange={(e) => {
            if (!abierto) setAbierto(true);
            setQuery(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key !== 'Enter') return;
            e.preventDefault();
            if (filtradas.length === 1) elegir(filtradas[0].valor);
            else if (ofrecerNuevo) elegir(clave(query));
          }}
          placeholder={etiquetaElegida && !abierto ? etiquetaElegida : placeholderBusqueda || placeholder}
          className={`${INPUT} ${error ? BORDER_ERR : BORDER_OK} pl-9 ${value ? 'pr-16' : 'pr-9'}`}
        />
        {/* Limpiar la selección */}
        {value && !abierto && (
          <button
            type="button"
            aria-label="Quitar la selección"
            onClick={() => onChange('')}
            className="absolute right-8 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X size={14} />
          </button>
        )}
        <ChevronDown
          size={16}
          onClick={() => (abierto ? cerrar() : campo.current?.focus())}
          className={`absolute right-2.5 top-1/2 -translate-y-1/2 cursor-pointer text-slate-400 transition-transform duration-200 ${
            abierto ? 'rotate-180' : ''
          }`}
        />
      </div>

      {/* El detalle de la opción elegida (p. ej. el documento), cuando no se está buscando */}
      {elegida?.detalle && !abierto && (
        <p className="mt-1 truncate pl-1 text-[11px] text-slate-400">{elegida.detalle}</p>
      )}

      {abierto && (
        <div className="absolute left-0 right-0 top-full z-30 mt-1.5 overflow-hidden rounded-xl ml-glass-panel border">
          <ul role="listbox" className="max-h-60 overflow-y-auto p-1">
            {ofrecerNuevo && (
              <li>
                <button
                  type="button"
                  onClick={() => elegir(clave(query))}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold text-amber-600 hover:bg-amber-400/10 dark:text-amber-400"
                >
                  <Plus size={13} className="shrink-0" /> Usar «{clave(query)}» como nueva
                </button>
              </li>
            )}
            {filtradas.map((o) => {
              const activa = o.valor === value;
              return (
                <li key={String(o.valor)}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={activa}
                    onClick={() => elegir(o.valor)}
                    className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-xs font-medium transition-colors ${
                      activa
                        ? 'bg-amber-400/15 text-amber-600 dark:text-amber-400'
                        : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/5'
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="block truncate">{o.etiqueta}</span>
                      {o.detalle && (
                        <span className="block truncate text-[11px] font-normal text-slate-400">{o.detalle}</span>
                      )}
                    </span>
                    {activa && <Check size={13} className="shrink-0" />}
                  </button>
                </li>
              );
            })}

            {filtradas.length === 0 && !ofrecerNuevo && (
              <li className="px-3 py-6 text-center text-xs text-slate-400">Sin coincidencias.</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
